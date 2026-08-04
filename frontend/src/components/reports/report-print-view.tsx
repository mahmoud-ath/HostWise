"use client";

/**
 * ReportPrintView — a dedicated, professionally-designed layout that is
 * hidden on screen and only rendered when printing / exporting to PDF
 * (triggered via `window.print()`). It is kept intentionally separate from
 * the interactive UI so the printed document stays clean, structured and
 * printer-friendly.
 */

import { formatCurrency, formatDate } from "@/lib/utils";
import type { PortfolioReport } from "@/lib/report-types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="report-section-title">
      <span>{children}</span>
    </h2>
  );
}

function SectionIntro({ children }: { children: React.ReactNode }) {
  return <p className="report-intro">{children}</p>;
}

function KpiBox({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const tones: Record<string, string> = {
    default: "report-kpi-default",
    good: "report-kpi-good",
    warn: "report-kpi-warn",
    bad: "report-kpi-bad",
  };
  return (
    <div className={`report-kpi ${tones[tone]}`}>
      <p className="report-kpi-label">{label}</p>
      <p className="report-kpi-value">{value}</p>
    </div>
  );
}

export function ReportPrintView({ report }: { report: PortfolioReport }) {
  const es = report.executive_summary;
  const cur = report.currency;
  const maxRevenue = Math.max(1, ...report.monthly_breakdown.map((m) => m.net_revenue));
  const maxExpense = Math.max(1, ...report.monthly_breakdown.map((m) => m.total_expenses));

  return (
    <div className="report-print-view">
      {/* ── Cover header ─────────────────────────────────── */}
      <header className="report-cover">
        <div className="report-cover-top">
          <div>
            <p className="report-brand">HostWise</p>
            <p className="report-org">{report.organization}</p>
          </div>
          <p className="report-doc">Financial Report</p>
        </div>
        <div className="report-cover-main">
          <h1>{report.period?.label ?? String(report.year)}</h1>
          <p className="report-period">
            {formatDate(report.period_start)} — {formatDate(report.period_end)}
          </p>
          <p className="report-meta">
            Generated {formatDate(report.generated_at)} · Currency {cur}
          </p>
        </div>
        <div className="report-cover-rule" />
        <div className="report-cover-foot">
          <span>Confidential</span>
          <span>HostWise Financial Intelligence</span>
        </div>
      </header>

      {/* ── Executive summary ───────────────────────────── */}
      <section className="report-section">
        <SectionTitle>Executive Summary</SectionTitle>
        <SectionIntro>
          {report.period?.label ?? report.year} closed with <strong>{formatCurrency(es.gross_revenue, cur)}</strong> gross revenue
          and a net profit of <strong>{formatCurrency(es.net_profit, cur)}</strong> ({es.profit_margin.toFixed(1)}%
          margin) across {es.property_count} properties. Portfolio health is{" "}
          <strong>{es.portfolio_health_score}/100</strong> ({es.portfolio_health_status}).
        </SectionIntro>
        <div className="report-kpis">
          <KpiBox label="Gross Revenue" value={formatCurrency(es.gross_revenue, cur)} />
          <KpiBox label="Net Profit" value={formatCurrency(es.net_profit, cur)} tone={es.net_profit >= 0 ? "good" : "bad"} />
          <KpiBox label="Profit Margin" value={`${es.profit_margin.toFixed(1)}%`} tone={es.profit_margin >= 20 ? "good" : es.profit_margin >= 0 ? "warn" : "bad"} />
          <KpiBox label="Portfolio Health" value={`${es.portfolio_health_score}/100`} tone={es.portfolio_health_score >= 70 ? "good" : es.portfolio_health_score >= 50 ? "warn" : "bad"} />
        </div>
        {(es.best_property || es.worst_property) && (
          <div className="report-two-col">
            {es.best_property && (
              <div className="report-callout report-callout-good">
                <p className="report-callout-label">Best performer</p>
                <p className="report-callout-title">{es.best_property.property_name}</p>
                <p className="report-callout-text">
                  {formatCurrency(es.best_property.net_revenue, cur)} net ·{" "}
                  {es.best_property.profit_margin.toFixed(1)}% margin
                </p>
              </div>
            )}
            {es.worst_property && (
              <div className="report-callout report-callout-bad">
                <p className="report-callout-label">Needs attention</p>
                <p className="report-callout-title">{es.worst_property.property_name}</p>
                <p className="report-callout-text">
                  {formatCurrency(es.worst_property.net_revenue, cur)} net ·{" "}
                  {es.worst_property.profit_margin.toFixed(1)}% margin
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── KPI comparison ──────────────────────────────── */}
      <section className="report-section">
        <SectionTitle>KPI Comparison</SectionTitle>
        <table className="report-table">
          <thead>
            <tr>
              <th>KPI</th>
              <th className="num">Previous</th>
              <th className="num">Current</th>
              <th className="num">Change</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(report.kpi_comparison).map(([key, v]) => (
              <tr key={key}>
                <td>{key.charAt(0).toUpperCase() + key.slice(1)}</td>
                <td className="num">{formatCurrency(v.previous, cur)}</td>
                <td className="num">{formatCurrency(v.current, cur)}</td>
                <td className={`num ${(v.change_pct ?? 0) < 0 ? "neg" : "pos"}`}>
                  {v.change_pct === null ? "—" : `${v.change_pct >= 0 ? "+" : ""}${v.change_pct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Property performance ────────────────────────── */}
      <section className="report-section">
        <SectionTitle>Property Performance</SectionTitle>
        <table className="report-table">
          <thead>
            <tr>
              <th>Property</th>
              <th className="num">Gross</th>
              <th className="num">Net</th>
              <th className="num">Expenses</th>
              <th className="num">Profit</th>
              <th className="num">Margin</th>
              <th className="num">Reservations</th>
              <th className="num">Health</th>
            </tr>
          </thead>
          <tbody>
            {report.property_performance.map((p) => (
              <tr key={p.property_id}>
                <td>{p.property_name}</td>
                <td className="num">{formatCurrency(p.gross_revenue, cur)}</td>
                <td className="num">{formatCurrency(p.net_revenue, cur)}</td>
                <td className="num">{formatCurrency(p.total_expenses, cur)}</td>
                <td className="num">{formatCurrency(p.profit, cur)}</td>
                <td className="num">{p.profit_margin.toFixed(1)}%</td>
                <td className="num">{p.reservation_count}</td>
                <td className="num">{p.health_score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Monthly timeline (CSS bar chart) ─────────────── */}
      <section className="report-section">
        <SectionTitle>Monthly Timeline</SectionTitle>
        <div className="report-bars">
          {report.monthly_breakdown.map((m) => (
            <div key={m.month} className="report-bar-col">
              <div className="report-bar-values">
                <span className="report-bar-val">{Math.round((m.net_revenue / maxRevenue) * 100)}</span>
              </div>
              <div className="report-bar-track">
                <div
                  className="report-bar report-bar-rev"
                  style={{ height: `${Math.max(2, (m.net_revenue / maxRevenue) * 100)}%` }}
                  title={`${MONTH_NAMES[m.month - 1]}: ${formatCurrency(m.net_revenue, cur)}`}
                />
                <div
                  className="report-bar report-bar-exp"
                  style={{ height: `${Math.max(2, (m.total_expenses / maxExpense) * 100)}%` }}
                  title={`${MONTH_NAMES[m.month - 1]} expenses: ${formatCurrency(m.total_expenses, cur)}`}
                />
              </div>
              <p className="report-bar-label">{MONTH_NAMES[m.month - 1].slice(0, 3)}</p>
            </div>
          ))}
        </div>
        <p className="report-legend">
          <span className="report-legend-swatch report-legend-rev" /> Net revenue
          <span className="report-legend-swatch report-legend-exp" /> Expenses
        </p>
      </section>

      {/* ── Expense analysis ────────────────────────────── */}
      <section className="report-section">
        <SectionTitle>Expense Analysis</SectionTitle>
        <table className="report-table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Total</th>
              <th className="num">Share</th>
              <th className="num">Entries</th>
            </tr>
          </thead>
          <tbody>
            {report.expense_analysis.categories.map((c) => (
              <tr key={c.category_name}>
                <td>{c.category_name}</td>
                <td className="num">{formatCurrency(c.total, cur)}</td>
                <td className="num">{c.percentage.toFixed(1)}%</td>
                <td className="num">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Risks, goals, forecast ──────────────────────── */}
      <section className="report-section">
        <SectionTitle>Risks &amp; Goals</SectionTitle>
        {report.risks.length > 0 ? (
          <ul className="report-risk-list">
            {report.risks.map((r, i) => (
              <li key={i} className="report-risk">
                <span className={`report-risk-badge ${r.level === "high" ? "report-risk-high" : "report-risk-medium"}`}>
                  {r.level.toUpperCase()}
                </span>
                <div>
                  <p className="report-risk-title">{r.title}</p>
                  <p className="report-risk-detail">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <SectionIntro>No significant risks were detected for this period.</SectionIntro>
        )}
        <div className="report-two-col">
          <div className="report-callout">
            <p className="report-callout-label">Revenue goal</p>
            <p className="report-callout-text">
              {formatCurrency(report.goals.revenue.current, cur)} of{" "}
              {formatCurrency(report.goals.revenue.goal, cur)} —{" "}
              {report.goals.revenue.progress >= 1 ? "achieved" : `${(report.goals.revenue.progress * 100).toFixed(0)}% complete`}
            </p>
          </div>
          <div className="report-callout">
            <p className="report-callout-label">Next-quarter forecast</p>
            <p className="report-callout-text">
              {formatCurrency(report.forecast.next_quarter_revenue, cur)} · confidence{" "}
              {(report.forecast.confidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </section>

      {/* ── Tax summary ─────────────────────────────────── */}
      <section className="report-section">
        <SectionTitle>Tax Summary</SectionTitle>
        <table className="report-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rental income</td>
              <td className="num">{formatCurrency(report.tax_summary.rental_income, cur)}</td>
            </tr>
            <tr>
              <td>Deductible expenses</td>
              <td className="num">{formatCurrency(report.tax_summary.deductible_expenses, cur)}</td>
            </tr>
            <tr>
              <td>Estimated taxable income</td>
              <td className="num">{formatCurrency(report.tax_summary.estimated_taxable_income, cur)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="report-footer">
        <span>HostWise — {report.organization}</span>
        <span>Page </span>
        <span className="report-page-num" />
      </footer>
    </div>
  );
}
