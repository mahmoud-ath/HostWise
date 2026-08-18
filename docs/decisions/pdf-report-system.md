# HostWise Professional PDF Report System — Design

> Status: **Proposal (v1)** · Area: Reports · Owner: Reports module
> This document designs the next generation of the HostWise report: a
> **date-range-driven, document-grade PDF** that reads like a Deloitte /
> QuickBooks / Power BI deliverable — not a screenshot of a web page.

---

## 0. Executive summary

The current report is a **screen-first page** that happens to be printable. It
is year-only, its "PDF" is a CSS print of the interactive layout, and its
sections are ordered for on-screen scanning, not for reading on paper.

This design replaces that with a **period-driven report engine + a dedicated
document renderer**:

1. **The report becomes period-based** (custom start/end dates), with presets
   (This quarter, This year, Last year, Custom). A year is just one preset.
2. **One normalized `ReportDocument` model** is produced by the backend and
   consumed by every exporter (PDF, Excel, CSV, Print, Share) so numbers can
   never drift between formats.
3. **A dedicated PDF document tree** (cover, TOC, headers/footers, pagination,
   tables, charts) replaces the "print the React page" approach. The
   interactive page and the PDF share **data only, never layout**.

Why this is worth doing: a report is the artifact a host hands to an owner,
a lender, or an accountant. Its job is to **make a decision obvious** and to
**survive being read cold on paper**. Screen-first layout optimises for
clicking; document layout optimises for reading, filing, and trust.

---

## 1. Design principles (the "why" behind every choice)

| Principle | Meaning | Consequence in this design |
| --- | --- | --- |
| **Answer first, detail after** | Busy readers stop after the summary | Executive summary is page 1 of content; every section after it is an appendix that *proves* the headline |
| **One source of truth** | PDF and Excel must show identical numbers | A single `ReportDocument` model feeds all renderers |
| **Period over period** | A number alone has no meaning | Every KPI shows a delta vs the equally-sized **previous period** |
| **Auditable** | A reader must be able to trust & verify | Method, source dates, and "n/a vs 0" discipline are explicit |
| **Honest absence** | Never fabricate | Insufficient history renders as "—", not as a computed number |
| **Print-native** | Paper is the target medium | Real pagination, repeating headers/footers, avoid-table-split rules |
| **Renderer-agnostic data** | The document must outlive any one format | Sections are typed data; PDF/Excel/CSV are just views of them |

---

## 2. Custom date range — the foundational change

### 2.1 Why year-only is wrong

A fiscal year is an arbitrary calendar artifact. Hosts need to report on:

- a **season** (e.g., Apr–Sep high season),
- a **campaign or renovation window**,
- a **pre/post-acquisition period**,
- **rolling 12 months** (for a lender),
- or a **partial year** when the business started mid-year.

QuickBooks, Power BI, and every serious reporting tool are period-driven for
this reason. A report without a period is a snapshot the reader cannot anchor.

### 2.2 Target UX

```
[ This year ▾ ] [ This quarter ] [ Last year ] [ Custom: 01/01/2026 – 30/06/2026 ]
```

- Presets are conveniences; **custom range is first-class**, not an afterthought.
- The default stays "This year" so nothing about the current flow breaks.
- When a custom range is chosen, the report title, subtitle, charts, KPIs,
  and the "comparable period" all re-anchor to that range.

### 2.3 Comparable period (the core insight)

Every KPI delta is meaningless without a baseline. For an arbitrary range the
baseline is the **equally-sized window immediately before it**:

```
Custom period:    Jan 1 – Jun 30, 2026   (181 days)
Previous period:  Jul 1 – Dec 31, 2025   (184 days, "same length back")
```

The report engine always computes both. This is what turns the document from a
"here is what happened" into a "are we better or worse, and by how much"
decision tool — the same pattern as the current YoY comparison, generalised to
any length.

### 2.4 Backend shape (small example only)

The analytics services currently hard-code year bounds
(`start_date = date(year, 1, 1)` / `end_date = date(year, 12, 31)`). They are
**already date-filterable at the repository level** (`get_total_revenue(start_date=…, end_date=…)`,
`get_expenses_by_category(start_date=…, end_date=…)`). The change is to expose
that filtering up through the service layer with backward-compatible defaults:

```python
# Current (year-only):
async def get_portfolio_analytics(self, year: int) -> dict:
    start_date, end_date = date(year, 1, 1), date(year, 12, 31)
    ...

# Proposed (period-based; year stays a preset):
async def get_portfolio_analytics(
    self,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    ...
```

And the flagship endpoint becomes period-based:

```text
GET /api/v1/reports/portfolio
    ?start_date=2026-01-01
    &end_date=2026-06-30
    &currency=MAD
```

The response adds a `period` object so every renderer can label itself
consistently:

```json
{
  "period": {
    "start": "2026-01-01",
    "end": "2026-06-30",
    "label": "Jan 1 – Jun 30, 2026",
    "days": 181
  },
  "previous_period": {
    "start": "2025-07-01",
    "end": "2025-12-31",
    "label": "Jul 1 – Dec 31, 2025",
    "days": 184
  },
  ...
}
```

### 2.5 Month bucketing for arbitrary ranges

The current `monthly_breakdown` is a fixed 12-month calendar year. For a custom
range it must bucket **by the months that intersect the range**, marking
partial months (e.g., `Jun 2026 · 15 of 30 days`) so a reader never mistakes a
partial month for a full one. This feeds the trend charts and the monthly
appendix identically.

### 2.6 What does *not* change

- The **currency** selector, tax rate, and AI provider are orthogonal to the
  period and keep working as-is.
- The interactive page's query key becomes
  `["portfolio-report", start, end, currency]` instead of `[year, currency]`.

---

## 3. Report content: what to include and exclude

### 3.1 Include (each justifies a decision — see §4)

| Section | Supports this business decision |
| --- | --- |
| Cover | Identification & filing |
| Executive summary + health score | "Is the business healthy, in one page?" |
| AI narrative + top actions | "What should I do next?" |
| KPI scorecard w/ previous-period delta | "Are we better or worse?" |
| Revenue vs expense trend + cashflow | "Is momentum real? When is cash tight?" |
| Property performance (ranked) | "Where do I invest / divest?" |
| Expense analysis (by category) | "Where do I cut?" |
| Forecast (next quarter) | "What should I plan/budget for?" |
| Risks & opportunities | "What could hurt me / help me?" |
| Tax summary | Filing & owner reporting |
| Monthly detail appendix | Audit, verification |
| Methodology & disclaimer | Trust, legal |

### 3.2 Exclude (and why)

| Excluded | Why |
| --- | --- |
| Buttons, filters, toasts, live chat | Not a document; they are interactive affordances |
| Onboarding/wizard, settings | Not report content |
| Empty expense categories | Fabricated-looking "0%" rows erode trust |
| "Fastest growing" when no prior period | It is unknowable → render "—", never a made-up number |
| Occupancy/ADR unless truly tracked | The app no longer tracks them as headline metrics (see `reports-audit.md`) |
| Decorations & animations | Waste ink, distract, and break in print |

> **Rule of thumb:** a section earns its place only if a reader can make a
> **different decision** because it is present.

---

## 4. Section order and the page-by-page layout

Reading order follows the decision pyramid: **conclusion → evidence →
verification**. A lender reads the summary, skims to the numbers, then checks
the appendix. The document is ordered for that reader, not for the author.

| Page | Section | Why this order |
| --- | --- | --- |
| 1 | **Cover** — brand, title, period, prepared-for, generated, confidentiality | Anchors the document: who, what, when. Filing-friendly. |
| 2 | **Executive summary** — 3–5 headline KPIs + health gauge + AI narrative + top 3 actions | The decision page. Everything after is proof. |
| 3 | **KPI scorecard** — gross/net/margin/cashflow with ▲/▼ vs previous period | Instant "better or worse" scan. |
| 4 | **Trend charts** — revenue vs expenses (bar), cashflow (line) | Visual proof of seasonality & momentum. |
| 5–6 | **Property performance** — ranked table (revenue, expenses, profit, margin, health) | Portfolio allocation: invest / divest / price. |
| 6 | **Expense analysis** — categories with % of total & growth | Cost control: what to renegotiate. |
| 7 | **Forecast + risks & opportunities** | Forward-looking: what to plan / mitigate. |
| 8 | **Tax summary** | Compliance & owner reporting. |
| 9+ | **Appendix** — monthly detail, methodology, disclaimer | Audit trail; keeps the body clean. |

**Pagination rules:**
- Each numbered section starts on a fresh page (`break-before: page`).
- Tables must not split mid-row; a table too big for one page repeats its
  header on the next page.
- The running header carries *brand · section title*; the footer carries
  *Page X of Y · Generated {date} · Confidential*.

---

## 5. Component architecture: interactive page ≠ PDF renderer

### 5.1 Why separate them

The interactive page is a **tool** (filters, live updates, hover tooltips,
retry states). The PDF is an **artifact** (fixed, paginated, branded). If the
PDF reuses the page's components, we get the current problem: interactive
layout leaking into print (buttons on paper, non-breaking sections, no page
headers). Sharing **data only** means layout can evolve independently and the
PDF can be re-rendered headlessly without a browser page.

### 5.2 Shared, typed document model

Every exporter consumes one model — this is the guarantee that numbers are
identical across PDF, Excel, and CSV:

```ts
// lib/report-model.ts (typed, renderer-agnostic)
interface ReportDocument {
  meta: {
    title: string;
    periodLabel: string;          // "Jan 1 – Jun 30, 2026"
    preparedFor: string;          // business/profile name
    generatedAt: string;
    currency: string;
    provider: "hostwise" | string; // rules vs LLM, for the AI section
  };
  sections: ReportSection[];       // already in reading order
}

interface ReportSection {
  id: string;
  kind: "cover" | "kpi" | "table" | "chart" | "text";
  title: string;
  pageBreak?: "before" | "after";
  data: KpiSection | TableSection | ChartSection | TextSection;
}
```

The backend's portfolio payload is **already** a superset of this; the frontend
maps it into `ReportDocument` once, in one place.

### 5.3 Renderers are interchangeable

```ts
// lib/report-exporters.ts
interface ReportRenderer {
  render(doc: ReportDocument): Promise<RenderResult>; // file or print
}

export const renderers: Record<ExportFormat, ReportRenderer> = {
  pdf:   new PdfRenderer(),    // document tree → print/headless PDF
  excel: new ExcelRenderer(),  // tables → .xlsx (or keep HTML-.xls)
  csv:   new CsvRenderer(),    // each table → one flat CSV
  print: new PrintRenderer(),  // document tree → window.print()
};
```

The Reports page calls `renderers[format].render(doc)` and nothing else —
adding a format later means adding one renderer, not re-plumbing the page.

### 5.4 Folder shape (frontend)

```
src/components/reports/
  page/            # interactive only: report-header, controls, preview shells
  pdf/             # document tree ONLY: PdfCover, PdfKpiGrid, PdfTable,
                   # PdfChart, PdfSection, PdfHeader/Footer, PdfAppendix
  model/           # ReportDocument types + backend→model mapper
  exporters/       # pdf.ts, excel.ts, csv.ts, print.ts
```

The interactive `page/` and the `pdf/` tree **never import each other's
components**; they only share `model/` types.

---

## 6. PDF rendering approach

### 6.1 Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| **A. Print-optimised React + `window.print()`** (today) | Zero deps; reuses React; charts render natively | CSS pagination is browser-fragile; no real page headers/TOC/bookmarks; depends on browser UI |
| **B. Headless Chromium → PDF** (Playwright/Puppeteer on the backend) | Pixel-perfect; full CSS paging; bookmarks; identical on every machine; best for desktop (Tauri bundles the backend) | Heavy dependency; adds a Chromium binary |
| **C. `@react-pdf/renderer`** | True PDF, small, exact control | Re-implements charts & layout in a second UI language; duplicates work |

### 6.2 Recommendation

**Build the document tree (the hard part) once, and make the rasterizer
pluggable.** Specifically:

1. **Now:** render the `pdf/` document tree in a hidden `print:block`
   container and call `window.print()` with a dedicated print stylesheet.
   This is a pure improvement over printing the interactive page: real cover,
   paged sections, repeating header/footer, tabular figures — zero new
   dependencies, works today.
2. **Later:** add a `PdfRenderer` that reuses the **same tree** through a
   headless renderer for a consistent, browser-independent file (needed for
   true server-side PDF and identical output on all machines).

Because the content lives in the `pdf/` tree, switching rasterizer is a
renderer swap, not a content rewrite.

### 6.3 Charts in the PDF

Keep **vector** where possible (SVG/CSS bars — crisp at any zoom, print
perfectly). For the line/bar trends, render Chart.js charts to `canvas` and
embed as **high-DPI PNG** (2× scale) with captions; add the underlying numbers
in the appendix so the chart is a visual summary, not the only record.

---

## 7. Typography, spacing, tables, charts, and branding

### 7.1 Type

- **One family, two weights** for a calm professional look (e.g., Inter):
  SemiBold for headings, Regular for body. Serif display only if we later want
  a "formal annual report" feel.
- **Tabular numerals are non-negotiable** for financial tables
  (`font-variant-numeric: tabular-nums`) so columns align and digits don't
  jitter when scanning. This alone changes how "financial" a table looks.
- Scale: Title 28/34 · Section 18/24 · KPI value 22/28 · Body 10/14 · Caption 8/11.

### 7.2 Spacing & grid

- 8-pt spacing system; sections separated by 24 pt; the eye needs consistent
  rhythm to trust the document.
- Content column ~ 60–65ch; tables may run full width.

### 7.3 Tables

- Right-align numbers, left-align labels; thousands separators; currency
  symbol in the **column header** once (not per cell).
- Zebra striping (very light) + a **bold total row with a top border** — the
  eye lands on the total.
- Repeat the header row when a table spans pages; never split a row.

### 7.4 Charts

- One palette shared with the app accent; **color-blind-safe**; always pair
  color with shape/label (▲/▼) so meaning survives grayscale printing.
- Every chart gets a title and a "Source: {period} data" caption.

### 7.5 Branding

- Cover: logo mark + HostWise wordmark, the **period** as the hero element,
  prepared-for + generated date, and a confidentiality note.
- Running footer: *HostWise · Page X of Y · Confidential*; tiny brand mark in
  the header. Brand consistency is what makes a host's report feel like a
  product, not a spreadsheet export.

---

## 8. Scalable export engine (PDF / Excel / CSV / Print from one model)

The current exporters are client-side and dependency-free (CSV via RFC-4180,
Excel via HTML-.xls, PDF via print). The target is a **single engine** with a
format registry:

```text
ReportDocument (normalized)
   ├─► PdfRenderer    (document tree → PDF)
   ├─► ExcelRenderer  (each section → sheet/table)
   ├─► CsvRenderer    (each table → flat file)
   ├─► PrintRenderer  (document tree → browser print)
   └─► (future) Email/Share — same model, different transport
```

**Server-side export endpoint** (recommended for real PDF + Tauri desktop):

```text
GET /api/v1/reports/export?format=pdf&start_date=…&end_date=…&currency=MAD
→ application/pdf
```

The frontend simply downloads the blob. This matters because:
- Real PDF needs a renderer that is **not** the user's browser (consistency).
- It centralises tax-rate, currency, and branding so every format agrees.
- It keeps the interactive page fast (it only fetches JSON for preview).

**Format config** lives next to the model:

```ts
const FORMAT_CONFIG: Record<ExportFormat, { page?: "A4"|"Letter"; sections: string[] }> = {
  pdf:   { page: "A4", sections: ALL_SECTIONS },
  excel: { sections: ["kpi", "property", "expense", "monthly", "tax"] },
  csv:   { sections: ["property", "expense", "monthly"] },
};
```

> Note: we keep the existing zero-dependency CSV/Excel helpers — they are the
> "smallest working renderer" and already conform to this shape. The redesign
> formalises the interface around them.

---

## 9. Implementation roadmap

1. **Backend period support** — add `start_date`/`end_date` to analytics
   services (backward-compatible), add `get_range_report`, extend
   `/reports/portfolio` with `start_date`/`end_date` + `period` object.
2. **Frontend period picker** — presets + custom range; change query key to
   `[start, end, currency]`; keep defaults = current year (no visual break).
3. **`ReportDocument` model** — one mapper from the API payload to the typed
   model; the interactive page keeps working off the same data.
4. **`pdf/` document tree** — cover, sections, tables, charts, header/footer,
   pagination rules; wire to `window.print()` (better PDF today, no deps).
5. **Exporter registry** — refactor CSV/Excel/print into
   `exporters/*` implementing `ReportRenderer`; add `/reports/export?format=`.
6. **(Later) Headless PDF** — swap the PDF rasterizer behind `PdfRenderer`
   without touching the document tree.

Each step is independently shippable and doesn't block the next.

---

## 10. Decisions at a glance

| Decision | Choice | Why |
| --- | --- | --- |
| Period model | Custom range + presets, year is a preset | Reports must answer "what happened in *this* window" |
| Comparison baseline | Equally-sized previous period | Deltas need a fair baseline; YoY is a special case |
| Data model | One `ReportDocument`, N renderers | Numbers can't drift between PDF/Excel/CSV |
| PDF content | Dedicated `pdf/` tree, not the page | Paper needs pagination/branding, not buttons/tooltips |
| Rasterizer | Pluggable; print-CSS now, headless later | Ship value now; keep door open for server PDF |
| Honesty | "—" for unknowable, never fabricated | Trust is the product for an owner/lender-facing doc |
