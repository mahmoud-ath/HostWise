"""
Reports Module — PDF Export Service

Renders the professional financial report to a real PDF on the backend using
WeasyPrint (HTML + CSS → PDF).

The document structure mirrors the frontend `ReportPrintView` (cover, executive
summary, AI executive insights, KPI comparison, property performance, monthly
timeline, expense analysis, risks & goals) so the downloaded file looks
identical to the print layout — but generation no longer depends on the user's
browser, and the output is the same on every machine.

Used by: GET /api/v1/reports/export?format=pdf&start_date=…&end_date=…&currency=…
"""
from datetime import date

from weasyprint import HTML

CURRENCY_SYMBOL = {
    "USD": "$", "EUR": "€", "GBP": "£",
    "MAD": "MAD ", "AED": "AED ", "CAD": "C$", "AUD": "A$", "CHF": "CHF ",
}

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# ── Formatting helpers (mirror the frontend's formatCurrency/formatDate) ──

def _money(value, currency: str) -> str:
    symbol = CURRENCY_SYMBOL.get(str(currency).upper(), f"{currency} ")
    try:
        return f"{symbol}{value:,.0f}"
    except (TypeError, ValueError):
        return f"{symbol}0"


def _pct(value) -> str:
    try:
        return f"{value:.1f}%"
    except (TypeError, ValueError):
        return "—"


def _date(iso) -> str:
    if not iso:
        return ""
    try:
        d = date.fromisoformat(str(iso)[:10])
        return d.strftime("%b %d, %Y")
    except (TypeError, ValueError):
        return str(iso)[:10]


def _esc(value) -> str:
    """Minimal HTML escaping for dynamic strings."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ── Print stylesheet (standalone port of the app's print CSS) ──

CSS = """
@page {
  size: A4;
  margin: 14mm 16mm;
  @bottom-left {
    content: "HostWise — Confidential";
    font-size: 8px;
    color: #9ca3af;
  }
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 8px;
    color: #9ca3af;
  }
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  line-height: 1.5;
  color: #1f2937;
  background: #fff;
}

/* ── Cover ── */
.report-cover { border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 22px; }
.report-cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
.report-brand { font-size: 16px; font-weight: 800; letter-spacing: 0.05em; color: #0f766e; text-transform: uppercase; margin: 0; }
.report-org { font-size: 12px; color: #6b7280; margin-top: 2px; }
.report-doc { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; }
.report-cover-main { margin: 18px 0 10px; text-align: center; }
.report-cover-main h1 { font-size: 44px; font-weight: 800; line-height: 1; color: #111827; margin: 0; }
.report-period { font-size: 14px; color: #374151; margin-top: 8px; }
.report-meta { font-size: 10px; color: #9ca3af; margin-top: 4px; }
.report-cover-rule { height: 1px; background: #e5e7eb; margin: 12px 0 8px; }
.report-cover-foot { display: flex; justify-content: space-between; font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; color: #9ca3af; }

/* ── Sections ── */
.report-section { break-inside: avoid; margin-bottom: 20px; }
.report-section-title { font-size: 14px; font-weight: 700; color: #111827; border-left: 4px solid #0f766e; padding-left: 10px; margin: 0 0 10px; }
.report-intro { color: #374151; margin: 0 0 12px; }
.report-ai-provider { display: inline-block; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #0f766e; border: 1px solid #0f766e; border-radius: 999px; padding: 2px 8px; margin: 0 0 10px; }
.report-ai-drivers { font-size: 10px; color: #4b5563; margin: 0 0 12px; }

/* ── KPI boxes ── */
.report-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.report-kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #f9fafb; }
.report-kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 0; }
.report-kpi-value { font-size: 16px; font-weight: 700; color: #111827; margin-top: 2px; }
.report-kpi-good { border-color: #d1fae5; background: #ecfdf5; }
.report-kpi-good .report-kpi-value { color: #047857; }
.report-kpi-warn { border-color: #fde68a; background: #fffbeb; }
.report-kpi-warn .report-kpi-value { color: #b45309; }
.report-kpi-bad { border-color: #fecaca; background: #fef2f2; }
.report-kpi-bad .report-kpi-value { color: #b91c1c; }

/* ── Tables ── */
.report-table { width: 100%; border-collapse: collapse; font-size: 10px; }
.report-table th { text-align: left; background: #f3f4f6; color: #374151; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 9px; padding: 6px 8px; border-bottom: 1px solid #d1d5db; }
.report-table th.num, .report-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.report-table td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; color: #1f2937; }
.report-table tbody tr:nth-child(even) { background: #fafafa; }
.report-table .pos { color: #047857; }
.report-table .neg { color: #b91c1c; }

/* ── Callouts ── */
.report-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.report-callout { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #f9fafb; }
.report-callout-good { border-color: #a7f3d0; background: #ecfdf5; }
.report-callout-bad { border-color: #fecaca; background: #fef2f2; }
.report-callout-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 0; }
.report-callout-title { font-size: 13px; font-weight: 700; color: #111827; margin: 2px 0 0; }
.report-callout-text { font-size: 10px; color: #4b5563; margin: 2px 0 0; }

/* ── CSS bar chart ── */
.report-bars { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; align-items: end; height: 130px; padding: 8px 4px 0; border-bottom: 1px solid #d1d5db; margin-bottom: 4px; }
.report-bar-col { display: flex; flex-direction: column; justify-content: flex-end; height: 100%; gap: 2px; }
.report-bar-track { position: relative; display: flex; align-items: flex-end; gap: 2px; height: 108px; }
.report-bar { width: 50%; border-radius: 2px 2px 0 0; }
.report-bar-rev { background: #0f766e; }
.report-bar-exp { background: #f59e0b; }
.report-bar-label { text-align: center; font-size: 8px; color: #6b7280; margin: 0; }
.report-legend { font-size: 9px; color: #6b7280; margin: 6px 0 0; display: flex; align-items: center; gap: 6px; }
.report-legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
.report-legend-rev { background: #0f766e; }
.report-legend-exp { background: #f59e0b; margin-left: 10px; }

/* ── Risks ── */
.report-risk-list { list-style: none; margin: 0 0 12px; padding: 0; }
.report-risk { display: flex; gap: 10px; padding: 8px 10px; border: 1px solid #f3f4f6; border-radius: 6px; margin-bottom: 6px; background: #fafafa; }
.report-risk-badge { font-size: 8px; font-weight: 700; padding: 2px 6px; border-radius: 999px; height: fit-content; letter-spacing: 0.05em; }
.report-risk-high { background: #fee2e2; color: #b91c1c; }
.report-risk-medium { background: #fef3c7; color: #b45309; }
.report-risk-title { font-size: 11px; font-weight: 600; color: #111827; margin: 0; }
.report-risk-detail { font-size: 10px; color: #4b5563; margin: 2px 0 0; }
"""


# ── Section builders ─────────────────────────────────────────────

def _cover(report: dict, cur: str) -> str:
    period = report.get("period") or {}
    label = period.get("label") or str(report.get("year", ""))
    return f"""
    <header class="report-cover">
      <div class="report-cover-top">
        <div>
          <p class="report-brand">HostWise</p>
          <p class="report-org">{_esc(report.get("organization", ""))}</p>
        </div>
        <p class="report-doc">Financial Report</p>
      </div>
      <div class="report-cover-main">
        <h1>{_esc(label)}</h1>
        <p class="report-period">{_date(report.get("period_start"))} — {_date(report.get("period_end"))}</p>
        <p class="report-meta">Generated {_date(report.get("generated_at"))} · Currency {_esc(cur)}</p>
      </div>
      <div class="report-cover-rule"></div>
      <div class="report-cover-foot">
        <span>Confidential</span>
        <span>HostWise Financial Intelligence</span>
      </div>
    </header>"""


def _kpis(es: dict, cur: str) -> str:
    margin = es.get("profit_margin", 0) or 0
    health = es.get("portfolio_health_score", 0) or 0
    net = es.get("net_profit", 0) or 0
    tone_net = "good" if net >= 0 else "bad"
    tone_margin = "good" if margin >= 20 else ("warn" if margin >= 0 else "bad")
    tone_health = "good" if health >= 70 else ("warn" if health >= 50 else "bad")
    return f"""
    <div class="report-kpis">
      <div class="report-kpi">
        <p class="report-kpi-label">Gross Revenue</p>
        <p class="report-kpi-value">{_money(es.get("gross_revenue", 0), cur)}</p>
      </div>
      <div class="report-kpi report-kpi-{tone_net}">
        <p class="report-kpi-label">Net Profit</p>
        <p class="report-kpi-value">{_money(net, cur)}</p>
      </div>
      <div class="report-kpi report-kpi-{tone_margin}">
        <p class="report-kpi-label">Profit Margin</p>
        <p class="report-kpi-value">{_pct(margin)}</p>
      </div>
      <div class="report-kpi report-kpi-{tone_health}">
        <p class="report-kpi-label">Portfolio Health</p>
        <p class="report-kpi-value">{health}/100</p>
      </div>
    </div>"""


def _best_worst(es: dict, cur: str) -> str:
    best = es.get("best_property")
    worst = es.get("worst_property")
    if not best and not worst:
        return ""
    cols = ""
    if best:
        cols += f"""
        <div class="report-callout report-callout-good">
          <p class="report-callout-label">Best performer</p>
          <p class="report-callout-title">{_esc(best.get("property_name", ""))}</p>
          <p class="report-callout-text">{_money(best.get("net_revenue", 0), cur)} net · {_pct(best.get("profit_margin", 0))} margin</p>
        </div>"""
    if worst:
        cols += f"""
        <div class="report-callout report-callout-bad">
          <p class="report-callout-label">Needs attention</p>
          <p class="report-callout-title">{_esc(worst.get("property_name", ""))}</p>
          <p class="report-callout-text">{_money(worst.get("net_revenue", 0), cur)} net · {_pct(worst.get("profit_margin", 0))} margin</p>
        </div>"""
    return f'<div class="report-two-col">{cols}</div>'


def _ai_section(ai: dict, cur: str) -> str:
    if not ai.get("summary"):
        return ""
    provider = ai.get("provider")
    provider_label = (
        "HostWise rules engine"
        if not provider or provider == "hostwise"
        else f"LLM · {provider}"
    )
    drivers = ai.get("drivers") or []
    drivers_html = ""
    if drivers:
        items = " · ".join(
            f"{_esc(d.get('label', ''))} {_esc(d.get('detail', ''))}" for d in drivers
        )
        drivers_html = (
            f'<p class="report-ai-drivers"><strong>What drove the change: </strong>{items}</p>'
        )

    risk = ai.get("biggest_risk")
    recommendation = ai.get("recommendation")
    calls = ""
    if risk and risk.get("title"):
        cause = f'<p class="report-callout-text">{_esc(risk.get("cause", ""))}</p>' if risk.get("cause") else ""
        calls += f"""
        <div class="report-callout report-callout-bad">
          <p class="report-callout-label">Biggest risk</p>
          <p class="report-callout-title">{_esc(risk.get("title", ""))}</p>
          {cause}
        </div>"""
    if recommendation:
        calls += f"""
        <div class="report-callout report-callout-good">
          <p class="report-callout-label">Recommendation</p>
          <p class="report-callout-text">{_esc(recommendation)}</p>
        </div>"""
    two_col = f'<div class="report-two-col">{calls}</div>' if calls else ""
    return f"""
    <section class="report-section">
      <h2 class="report-section-title"><span>AI Executive Insights</span></h2>
      <p class="report-ai-provider">{_esc(provider_label)}</p>
      <p class="report-intro">{_esc(ai.get("summary", ""))}</p>
      {drivers_html}
      {two_col}
    </section>"""


def _kpi_table(report: dict, cur: str) -> str:
    kpi = report.get("kpi_comparison") or {}
    previous_period = report.get("previous_period") or {}
    period = report.get("period") or {}
    if previous_period:
        comparison = (
            f"{previous_period.get('label', '')} vs "
            f"{period.get('label') or report.get('year', '')}"
        )
    else:
        comparison = f"Previous year ({report.get('year', 0) - 1}) vs {report.get('year', 0)}"
    intro = f'<p class="report-intro">{_esc(comparison)}</p>'

    rows = ""
    for key, label in (("revenue", "Revenue"), ("profit", "Profit"), ("expenses", "Expenses")):
        v = kpi.get(key) or {}
        change = v.get("change_pct")
        if change is None:
            change_html = "—"
        else:
            cls = "neg" if change < 0 else "pos"
            sign = "+" if change >= 0 else ""
            change_html = f'<span class="{cls}">{sign}{change:.1f}%</span>'
        rows += f"""
        <tr>
          <td>{label}</td>
          <td class="num">{_money(v.get("previous", 0), cur)}</td>
          <td class="num">{_money(v.get("current", 0), cur)}</td>
          <td class="num">{change_html}</td>
        </tr>"""
    return f"""
    <section class="report-section">
      <h2 class="report-section-title"><span>KPI Comparison</span></h2>
      {intro}
      <table class="report-table">
        <thead>
          <tr><th>KPI</th><th class="num">Previous</th><th class="num">Current</th><th class="num">Change</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _property_table(report: dict, cur: str) -> str:
    rows = ""
    for p in report.get("property_performance") or []:
        health = p.get("health_score")
        rows += f"""
        <tr>
          <td>{_esc(p.get("property_name", ""))}</td>
          <td class="num">{_money(p.get("gross_revenue", 0), cur)}</td>
          <td class="num">{_money(p.get("net_revenue", 0), cur)}</td>
          <td class="num">{_money(p.get("total_expenses", 0), cur)}</td>
          <td class="num">{_money(p.get("profit", 0), cur)}</td>
          <td class="num">{_pct(p.get("profit_margin", 0))}</td>
          <td class="num">{p.get("reservation_count", 0)}</td>
          <td class="num">{health if health is not None else "—"}</td>
        </tr>"""
    return f"""
    <section class="report-section">
      <h2 class="report-section-title"><span>Property Performance</span></h2>
      <table class="report-table">
        <thead>
          <tr><th>Property</th><th class="num">Gross</th><th class="num">Net</th><th class="num">Expenses</th><th class="num">Profit</th><th class="num">Margin</th><th class="num">Reservations</th><th class="num">Health</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _monthly_timeline(report: dict, cur: str) -> str:
    months = report.get("monthly_breakdown") or []
    if not months:
        return ""
    max_rev = max([m.get("net_revenue", 0) or 0 for m in months] + [1])
    max_exp = max([m.get("total_expenses", 0) or 0 for m in months] + [1])
    cols = ""
    for m in months:
        idx = m.get("month", 1) or 1
        name = MONTHS[idx - 1] if 1 <= idx <= 12 else str(idx)
        rev = m.get("net_revenue", 0) or 0
        exp = m.get("total_expenses", 0) or 0
        rev_h = max(2, round(rev / max_rev * 100))
        exp_h = max(2, round(exp / max_exp * 100))
        val = round(rev / max_rev * 100) if max_rev else 0
        cols += f"""
        <div class="report-bar-col">
          <div class="report-bar-values"><span class="report-bar-val">{val}</span></div>
          <div class="report-bar-track">
            <div class="report-bar report-bar-rev" style="height:{rev_h}%"></div>
            <div class="report-bar report-bar-exp" style="height:{exp_h}%"></div>
          </div>
          <p class="report-bar-label">{name[:3]}</p>
        </div>"""
    return f"""
    <section class="report-section">
      <h2 class="report-section-title"><span>Monthly Timeline</span></h2>
      <div class="report-bars">{cols}</div>
      <p class="report-legend">
        <span class="report-legend-swatch report-legend-rev"></span> Net revenue
        <span class="report-legend-swatch report-legend-exp"></span> Expenses
      </p>
    </section>"""


def _expense_section(report: dict, cur: str) -> str:
    cats = (report.get("expense_analysis") or {}).get("categories") or []
    rows = ""
    for c in cats:
        rows += f"""
        <tr>
          <td>{_esc(c.get("category_name", ""))}</td>
          <td class="num">{_money(c.get("total", 0), cur)}</td>
          <td class="num">{_pct(c.get("percentage", 0))}</td>
          <td class="num">{c.get("count", 0)}</td>
        </tr>"""
    return f"""
    <section class="report-section">
      <h2 class="report-section-title"><span>Expense Analysis</span></h2>
      <table class="report-table">
        <thead>
          <tr><th>Category</th><th class="num">Total</th><th class="num">Share</th><th class="num">Entries</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _risks_goals(report: dict, cur: str) -> str:
    risks = report.get("risks") or []
    if risks:
        risk_items = ""
        for r in risks:
            level = str(r.get("level", "medium")).upper()
            cls = "report-risk-high" if r.get("level") == "high" else "report-risk-medium"
            risk_items += f"""
            <li class="report-risk">
              <span class="report-risk-badge {cls}">{level}</span>
              <div>
                <p class="report-risk-title">{_esc(r.get("title", ""))}</p>
                <p class="report-risk-detail">{_esc(r.get("detail", ""))}</p>
              </div>
            </li>"""
        risk_html = f'<ul class="report-risk-list">{risk_items}</ul>'
    else:
        risk_html = '<p class="report-intro">No significant risks were detected for this period.</p>'

    goals = (report.get("goals") or {}).get("revenue") or {}
    progress = goals.get("progress", 0) or 0
    if progress >= 100:
        goal_text = f"{_money(goals.get('current', 0), cur)} of {_money(goals.get('goal', 0), cur)} — achieved"
    else:
        goal_text = f"{_money(goals.get('current', 0), cur)} of {_money(goals.get('goal', 0), cur)} — {progress:.0f}% complete"

    forecast = report.get("forecast") or {}
    return f"""
    <section class="report-section">
      <h2 class="report-section-title"><span>Risks &amp; Goals</span></h2>
      {risk_html}
      <div class="report-two-col">
        <div class="report-callout">
          <p class="report-callout-label">Revenue goal</p>
          <p class="report-callout-text">{goal_text}</p>
        </div>
        <div class="report-callout">
          <p class="report-callout-label">Next-quarter forecast</p>
          <p class="report-callout-text">{_money(forecast.get("next_quarter_revenue", 0), cur)} · confidence {forecast.get("confidence", 0)}%</p>
        </div>
      </div>
    </section>"""


# ── Document assembly ────────────────────────────────────────────

def render_pdf(report: dict) -> bytes:
    """Build the report document and return PDF bytes."""
    cur = str(report.get("currency") or "EUR")
    body = (
        _cover(report, cur)
        + _exec_section(report, cur)
        + _ai_section(report.get("ai_insights") or {}, cur)
        + _kpi_table(report, cur)
        + _property_table(report, cur)
        + _monthly_timeline(report, cur)
        + _expense_section(report, cur)
        + _risks_goals(report, cur)
    )
    period = report.get("period") or {}
    title = period.get("label") or str(report.get("year", ""))
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>HostWise Financial Report — {_esc(title)}</title>
<style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>"""
    return HTML(string=html).write_pdf()


def _exec_section(report: dict, cur: str) -> str:
    es = report.get("executive_summary") or {}
    period = report.get("period") or {}
    label = period.get("label") or str(report.get("year", ""))
    intro = (
        f"{_esc(label)} closed with <strong>{_money(es.get('gross_revenue', 0), cur)}</strong> gross revenue "
        f"and a net profit of <strong>{_money(es.get('net_profit', 0), cur)}</strong> ({_pct(es.get('profit_margin', 0))} "
        f"margin) across {es.get('property_count', 0)} properties. Portfolio health is "
        f"<strong>{es.get('portfolio_health_score', 0)}/100</strong> ({_esc(es.get('portfolio_health_status', ''))})."
    )
    return f"""
    <section class="report-section">
      <h2 class="report-section-title"><span>Executive Summary</span></h2>
      <p class="report-intro">{intro}</p>
      {_kpis(es, cur)}
      {_best_worst(es, cur)}
    </section>"""
