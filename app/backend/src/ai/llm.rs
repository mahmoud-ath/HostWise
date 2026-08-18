//! External LLM providers (BYOK) — the **external API** responsibility.
//!
//! Everything that talks to an outside model lives here: the OpenAI-compatible
//! client, gathering the real settings (unmasked key), building the data and
//! prompts we send, turning the model's reply into a report, marking honest
//! fallbacks, the test-connection probe and the free-form chat.
//!
//! The HostWise **rules engine** lives in `rules.rs`; `service.rs` is the thin
//! orchestrator that picks rules vs. this API.

use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::analytics::service as analytics;
use crate::core::error::AppError;
use crate::finance::service::FinanceService;
use crate::settings::service as settings;

/// Low-level OpenAI-compatible chat client (OpenAI/DeepSeek/Anthropic/Ollama).
pub struct LlmProvider;

impl LlmProvider {
    /// Call the configured LLM (OpenAI/DeepSeek/Anthropic-compatible/Ollama).
    pub async fn call(settings: &Value, system_prompt: &str, user_prompt: &str) -> Option<String> {
        let key = settings
            .get("ai_api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if key.is_empty() {
            return None;
        }
        let provider = settings
            .get("ai_provider")
            .and_then(|v| v.as_str())
            .unwrap_or("openai");

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(45))
            .build()
            .ok()?;

        let messages = json!([
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt },
        ]);

        if provider == "ollama" {
            let base = settings
                .get("ai_base_url")
                .and_then(|v| v.as_str())
                .unwrap_or("http://localhost:11434")
                .trim_end_matches('/')
                .to_string();
            let url = format!("{base}/api/chat");
            let model = settings
                .get("ai_model")
                .and_then(|v| v.as_str())
                .unwrap_or("llama3");
            let payload = json!({ "model": model, "messages": messages, "stream": false });
            let resp = client.post(&url).json(&payload).send().await.ok()?;
            let data: Value = resp.json().await.ok()?;
            return data
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .map(|s| s.to_string());
        }

        let (base, model) = if provider == "deepseek" {
            (
                settings
                    .get("ai_base_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("https://api.deepseek.com/v1"),
                settings
                    .get("ai_model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("deepseek-chat"),
            )
        } else {
            (
                settings
                    .get("ai_base_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("https://api.openai.com/v1"),
                settings
                    .get("ai_model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("gpt-4o-mini"),
            )
        };
        let url = format!("{}/chat/completions", base.trim_end_matches('/'));
        let payload = json!({ "model": model, "messages": messages, "temperature": 0.3 });

        let resp = client
            .post(&url)
            .bearer_auth(&key)
            .json(&payload)
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let data: Value = resp.json().await.ok()?;
        data.get("choices")
            .and_then(|c| c.as_array())
            .and_then(|a| a.first())
            .and_then(|ch| ch.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
    }

    /// Extract a JSON object from a model reply (strips code fences).
    pub fn extract_json(reply: &str) -> Option<Value> {
        let trimmed = reply.trim();
        let start = trimmed.find('{')?;
        let end = trimmed.rfind('}')?;
        serde_json::from_str(&trimmed[start..=end]).ok()
    }
}

/// Settings for LLM calls: `get_all()` but with the REAL (unmasked) API key.
/// `get_all()` masks the key for the client; the LLM needs the actual secret,
/// otherwise every external-provider call fails auth with "••••••••".
pub async fn llm_settings(pool: &SqlitePool) -> Result<Value, AppError> {
    let mut all = settings::get_all(pool).await?;
    if let Some(key) = settings::get_raw_api_key(pool).await {
        all["ai_api_key"] = Value::String(key);
    }
    Ok(all)
}

/// Mark the rules report as a fallback because the configured external LLM
/// could not be used. `provider` stays as the user configured — never silently
/// claim to be the rules engine.
fn mark_llm_fallback(report: &mut Value, provider: &str, reason: &str) {
    if let Value::Object(obj) = report {
        obj.insert("provider".into(), Value::String(provider.to_string()));
        obj.insert("llm_fallback".into(), Value::Bool(true));
        obj.insert(
            "llm_fallback_message".into(),
            Value::String(format!(
                "Could not use the {provider} LLM ({reason}) — showing built-in analysis instead. Check your API key, base URL and model in Settings → AI."
            )),
        );
    }
}

/// Send the host's real financial data to the external LLM and return its
/// report. When the provider fails (or replies with unusable JSON), returns the
/// rules engine's report marked as an honest fallback.
pub async fn enhance_report(
    pool: &SqlitePool,
    provider_settings: &Value,
    start: &str,
    end: &str,
    rules_report: Value,
) -> Result<Value, AppError> {
    let provider = provider_settings["ai_provider"]
        .as_str()
        .unwrap_or("hostwise")
        .to_string();
    let mut report = rules_report;
    let input = llm_input(pool, start, end).await?;
    let lang = provider_settings["ai_language"]
        .as_str()
        .unwrap_or("English");
    let lang_line = if lang != "English" {
        format!(" Respond in {lang}.")
    } else {
        String::new()
    };
    let system = format!(
        "You are HostWise, a vacation-rental financial advisor. You receive a JSON \
         object with the host's REAL financial data. Reply with a SINGLE JSON object \
         (no markdown, no code fences) with only these optional keys: executive_summary, \
         health_score, priority_actions, opportunities, lost_revenue, risks, \
         property_reviews, forecast, achievements, recommended_goals, trend_explanations. \
         Base every figure strictly on the provided data.{lang_line}"
    );
    let user = format!(
        "Here is the real portfolio data as JSON:\n{}",
        input.to_string()
    );
    match LlmProvider::call(provider_settings, &system, &user).await {
        Some(reply) => match LlmProvider::extract_json(&reply) {
            Some(Value::Object(llm_obj)) => {
                // The external LLM only reliably produces the free-text executive
                // summary. Every STRUCTURED section the UI renders (risks,
                // property reviews, forecast, goals, wins, opportunities, actions,
                // health score...) must keep the rules engine's well-formed shape
                // — the LLM keeps returning partial items (undefined
                // revenue_trend_pct, NaN expected_revenue, empty goal labels)
                // that render as "undefined%", "MADNaN" or empty cards.
                if let Value::Object(rules) = &mut report {
                    let mut structured: std::collections::HashMap<String, Value> =
                        std::collections::HashMap::new();
                    for key in [
                        "current_metrics",
                        "key_metrics",
                        "priority_actions",
                        "opportunities",
                        "lost_revenue",
                        "risks",
                        "property_reviews",
                        "forecast",
                        "achievements",
                        "recommended_goals",
                        "trend_explanations",
                        "health_score",
                    ] {
                        if let Some(v) = rules.get(key) {
                            structured.insert(key.to_string(), v.clone());
                        }
                    }

                    // Take only the LLM's narrative summary (if it's a string);
                    // every structured section stays the rules engine's.
                    if let Some(summary) = llm_obj.get("executive_summary").cloned() {
                        if summary.is_string() {
                            rules.insert("executive_summary".into(), summary);
                        }
                    }
                    for (k, v) in structured {
                        rules.insert(k, v);
                    }

                    rules.insert("provider".into(), Value::String(provider.clone()));
                }
            }
            _ => mark_llm_fallback(
                &mut report,
                &provider,
                "did not return a usable JSON response",
            ),
        },
        None => mark_llm_fallback(
            &mut report,
            &provider,
            "could not be reached (check the API key, base URL and model)",
        ),
    }
    Ok(report)
}

/// The financial data payload we send to the external provider.
async fn llm_input(pool: &SqlitePool, s: &str, e: &str) -> Result<Value, AppError> {
    let finance = FinanceService::from_pool(pool.clone());
    let summary = finance.get_summary(Some(s), Some(e)).await?;
    let portfolio = analytics::get_portfolio_analytics(pool, None, Some(s), Some(e)).await?;
    Ok(json!({
        "summary": {
            "net_revenue": summary.net_revenue,
            "total_expenses": summary.total_expenses,
            "net_cashflow": summary.cashflow,
            "revenue_count": summary.revenue_count,
            "expense_count": summary.expense_count,
        },
        "portfolio": portfolio,
    }))
}

/// Probe the configured external provider. The rules engine always "succeeds"
/// (it needs no external connection).
pub async fn test_connection(pool: &SqlitePool) -> Result<Value, AppError> {
    let all = llm_settings(pool).await?;
    let provider = all["ai_provider"].as_str().unwrap_or("hostwise");
    if provider == "hostwise" {
        return Ok(json!({
            "ok": true,
            "provider": "hostwise",
            "message": "Using the built-in rules engine — no external connection needed.",
        }));
    }
    match LlmProvider::call(
        &all,
        "You are a connectivity check.",
        "Reply with exactly: ok",
    )
    .await
    {
        Some(_) => Ok(json!({
            "ok": true,
            "provider": provider,
            "message": "Connection successful.",
        })),
        None => Ok(json!({
            "ok": false,
            "provider": provider,
            "message": "Could not reach the LLM provider. Check your API key, base URL, and model.",
        })),
    }
}

/// Free-form chat via the external LLM; `None` when hostwise or when the call
/// fails (the caller falls back to the rules engine).
pub async fn answer(provider_settings: &Value, question: &str) -> Option<String> {
    if provider_settings["ai_provider"]
        .as_str()
        .unwrap_or("hostwise")
        == "hostwise"
    {
        return None;
    }
    LlmProvider::call(
        provider_settings,
        "You are HostWise, a vacation-rental financial advisor. Answer concisely and use the portfolio data if relevant.",
        question,
    )
    .await
}
