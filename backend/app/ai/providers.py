"""
External LLM Providers (BYOK)

Handles calls to external OpenAI-compatible chat APIs — OpenAI, DeepSeek,
Anthropic (OpenAI-compatible), and local Ollama. Used when the user selects an
external provider in AI Settings. The built-in HostWise rules engine lives in
`app/ai/rules.py`.
"""
from sqlalchemy.ext.asyncio import AsyncSession


class LLMProvider:
    """Calls the user's configured LLM and merges its output into the report."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def call(
        self,
        settings: dict,
        system_prompt: str,
        user_prompt: str,
    ) -> str | None:
        """Call the user's LLM (BYOK) via an OpenAI-compatible chat endpoint."""
        import httpx

        key = settings.get("ai_api_key", "")
        if not key:
            return None
        provider = settings.get("ai_provider", "openai")

        if provider == "ollama":
            url = settings.get("ai_base_url", "http://localhost:11434").rstrip("/") + "/api/chat"
            payload = {
                "model": settings.get("ai_model", "llama3"),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
            }
            headers = {}
        elif provider == "deepseek":
            # DeepSeek exposes an OpenAI-compatible API.
            base = settings.get("ai_base_url", "https://api.deepseek.com/v1").rstrip("/")
            url = base + "/chat/completions"
            payload = {
                "model": settings.get("ai_model", "deepseek-chat"),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
            }
            headers = {"Authorization": f"Bearer {key}"}
        else:  # openai-compatible (OpenAI, Anthropic-compatible, local gateways)
            base = settings.get("ai_base_url", "https://api.openai.com/v1").rstrip("/")
            url = base + "/chat/completions"
            payload = {
                "model": settings.get("ai_model", "gpt-4o-mini"),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
            }
            headers = {"Authorization": f"Bearer {key}"}

        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if provider == "ollama":
            return data.get("message", {}).get("content")
        choices = data.get("choices") or []
        if not choices:
            return None
        return choices[0].get("message", {}).get("content")

    async def advisor_report(
        self, settings: dict, input_data: dict, language: str = "English"
    ) -> dict | None:
        """Send the real portfolio data (as JSON) to the configured LLM and get a
        JSON report back, which then updates the advisor page.

        The reply is parsed strictly (`_extract_json`); on ANY malformed output
        this returns None and the orchestrator falls back to the rules engine
        (roadmap 4.4). `language` (from `ai_language`) steers the LLM's tone.
        """
        import json

        lang_line = f" Respond in {language}." if language and language != "English" else ""
        system = (
            "You are HostWise, a vacation-rental financial advisor. "
            "You will receive a JSON object containing the host's REAL financial data. "
            "Analyze it and reply with a SINGLE JSON object (no markdown, no code fences) "
            "with only these optional keys: "
            "executive_summary (string), health_score (object with numeric score 0-100 and status), "
            "priority_actions (object with critical/medium/low arrays), opportunities (object), "
            "lost_revenue (object), risks (array), property_reviews (array), forecast (object), "
            "achievements (array), recommended_goals (array), trend_explanations (array). "
            "Base every figure strictly on the provided data. Do not invent data that is absent. "
            "Format monetary amounts with the currency code included in the data (e.g. MAD, EUR, USD)."
            + lang_line
        )
        user = (
            "Here is the real portfolio data as JSON:\n"
            + json.dumps(input_data, default=str, ensure_ascii=False)
        )
        try:
            reply = await self.call(settings, system, user)
        except Exception:  # noqa: BLE001 - deliberate: any LLM/network error → fall back to rules
            return None
        if not reply:
            return None
        return self._extract_json(reply)

    @staticmethod
    def _extract_json(reply: str) -> dict | None:
        """Robustly parse a JSON object from an LLM reply.

        Handles markdown code fences and trailing commas; returns None on any
        failure so the caller falls back to the rules engine (roadmap 4.4).
        """
        import json
        import re

        if not reply:
            return None
        text = reply.strip()
        # Strip markdown code fences (```json ... ```).
        fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
        if fence:
            text = fence.group(1).strip()
        # Direct parse first.
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except (ValueError, TypeError):
            pass
        # Fall back to first '{' → last '}', cleaning trailing commas.
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        candidate = re.sub(r",\s*([}\]])", r"\1", text[start:end + 1])
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except (ValueError, TypeError):
            return None

    @staticmethod
    def merge_report(base: dict, llm: dict) -> dict:
        """Overlay the LLM's JSON onto the rule-based report.

        Only `executive_summary` (free text) and `health_score` (score/status
        only — the `components` shape always comes from the rules engine) are
        overlaid, so the page can never break. Every other section stays
        grounded in the validated rule-based output.
        """
        if not isinstance(llm, dict):
            return base
        merged = dict(base)

        # Executive summary — safe free text.
        v = llm.get("executive_summary")
        if isinstance(v, str) and v.strip():
            merged["executive_summary"] = v.strip()

        # Health score — keep the rules engine's `components` structure; only
        # take score/status from the LLM when present.
        h = llm.get("health_score")
        if isinstance(h, dict) and isinstance(merged.get("health_score"), dict):
            for k in ("score", "status"):
                if isinstance(h.get(k), (int, float, str)):
                    merged["health_score"][k] = h[k]

        return merged

    @staticmethod
    def build_chat_context(report: dict) -> str:
        """Compact, data-grounded context string for the LLM."""
        m = report["current_metrics"]
        lines = [
            f"Year: {report['year']}",
            (
                f"Net revenue: {m['net_revenue']:.2f} EUR; profit: {m['profit']:.2f} EUR; "
                f"profit margin: {m['profit_margin']:.1f}%; expenses: {m['total_expenses']:.2f} EUR"
            ),
            f"Cancellation rate: {m['cancellation_rate']:.1f}%; properties: {m['property_count']}",
        ]
        reviews = report["property_reviews"][:5]
        if reviews:
            lines.append("Properties:")
            for r in reviews:
                lines.append(
                    f"- {r['property_name']}: {r['net_revenue']:.2f} revenue, "
                    f"{r['profit_margin']:.1f}% margin. {r['ai_summary']}"
                )
        if report["recommended_goals"]:
            lines.append(
                "Goals: "
                + "; ".join(
                    f"{g['label']} {g['current']} -> {g['target']}"
                    for g in report["recommended_goals"]
                )
            )
        return "\n".join(lines)

    async def test_connection(self) -> dict:
        """Validate the configured BYOK connection with a tiny prompt."""
        from app.settings.service import SettingsService

        settings = await SettingsService(self.session).get_all_internal()
        if not settings.get("ai_api_key"):
            return {"ok": False, "message": "No API key configured yet."}
        try:
            reply = await self.call(
                settings,
                "Reply with exactly: OK",
                "Say OK.",
            )
            if reply:
                return {"ok": True, "message": f"Connected! Model replied: {reply.strip()[:60]}"}
            return {"ok": False, "message": "Connected but got an empty reply."}
        except Exception as exc:  # noqa: BLE001 - intentional: surface any connection error to the user
            return {"ok": False, "message": f"Connection failed: {exc}"}
