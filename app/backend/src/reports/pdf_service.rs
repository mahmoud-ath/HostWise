//! Pure-Rust PDF rendering via `printpdf` — no external runtime.
//! Replaces the WeasyPrint (GTK/Pango) PDF export so the desktop app can
//! generate real PDFs on every platform with no native dependencies.

use printpdf::{
    BuiltinFont, Color, IndirectFontRef, Line, Mm, PdfDocument, PdfDocumentReference,
    PdfLayerIndex, PdfLayerReference, PdfPageIndex, Point, Polygon, Rgb,
};
use serde_json::Value;

// ── Palette ─────────────────────────────────────────────
const INK: (f32, f32, f32) = (0.13, 0.15, 0.17);
const MUTED: (f32, f32, f32) = (0.46, 0.49, 0.53);
const CARD: (f32, f32, f32) = (0.945, 0.955, 0.965);
const BORDER: (f32, f32, f32) = (0.85, 0.87, 0.9);
const PRIMARY: (f32, f32, f32) = (0.90, 0.24, 0.34);
const TEAL: (f32, f32, f32) = (0.0, 0.51, 0.54);
const GREEN: (f32, f32, f32) = (0.05, 0.50, 0.35);
const AMBER: (f32, f32, f32) = (0.85, 0.58, 0.09);
const RED: (f32, f32, f32) = (0.84, 0.25, 0.28);
const WHITE: (f32, f32, f32) = (1.0, 1.0, 1.0);

fn money(v: &Value) -> String {
    format!("{:.0}", v.as_f64().unwrap_or(0.0))
}

fn rgb(c: (f32, f32, f32)) -> Color {
    Color::Rgb(Rgb::new(c.0, c.1, c.2, None))
}

/// Simple word-wrapping (Helvetica has no auto-wrap in printpdf).
fn wrap(s: &str, width: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    for word in s.split_whitespace() {
        if !cur.is_empty() && cur.len() + word.len() + 1 > width {
            out.push(std::mem::take(&mut cur));
        }
        if !cur.is_empty() {
            cur.push(' ');
        }
        cur.push_str(word);
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// A tiny cursor-based renderer with automatic pagination.
struct Render {
    doc: PdfDocumentReference,
    font: IndirectFontRef,
    font_bold: IndirectFontRef,
    page: PdfPageIndex,
    layer: PdfLayerIndex,
    y: f32,
    page_no: u32,
}

impl Render {
    fn new(
        doc: PdfDocumentReference,
        font: IndirectFontRef,
        font_bold: IndirectFontRef,
        page: PdfPageIndex,
        layer: PdfLayerIndex,
    ) -> Self {
        Self {
            doc,
            font,
            font_bold,
            page,
            layer,
            y: 282.0,
            page_no: 1,
        }
    }

    fn l(&self) -> PdfLayerReference {
        self.doc.get_page(self.page).get_layer(self.layer)
    }

    /// Start a new page unless at least `need` mm is left below the cursor.
    fn ensure(&mut self, need: f32) {
        if self.y - need < 30.0 {
            let (p, l) = self.doc.add_page(Mm(210.0), Mm(297.0), "page");
            self.page = p;
            self.layer = l;
            self.y = 282.0;
            self.page_no += 1;
            self.footer();
        }
    }

    fn footer(&mut self) {
        let l = self.l();
        let _ = l.use_text(
            "HostWise — Confidential",
            8.0,
            Mm(20.0),
            Mm(12.0),
            &self.font,
        );
        let _ = l.use_text(
            &format!("Page {}", self.page_no),
            8.0,
            Mm(182.0),
            Mm(12.0),
            &self.font,
        );
    }

    fn text(&mut self, size: f32, s: &str, x: f32) {
        let l = self.l();
        l.set_fill_color(rgb(INK));
        let _ = l.use_text(s, size, Mm(x), Mm(self.y), &self.font);
        self.y -= size * 0.55;
    }

    fn text_bold(&mut self, size: f32, s: &str, x: f32) {
        let l = self.l();
        l.set_fill_color(rgb(INK));
        let _ = l.use_text(s, size, Mm(x), Mm(self.y), &self.font_bold);
        self.y -= size * 0.58;
    }

    fn rect(&mut self, x: f32, y: f32, w: f32, h: f32, c: (f32, f32, f32)) {
        let l = self.l();
        l.set_fill_color(rgb(c));
        let poly: Polygon = vec![
            (Point::new(Mm(x), Mm(y)), false),
            (Point::new(Mm(x + w), Mm(y)), false),
            (Point::new(Mm(x + w), Mm(y + h)), false),
            (Point::new(Mm(x), Mm(y + h)), false),
        ]
        .into_iter()
        .collect();
        l.add_polygon(poly);
    }

    fn rect_outline(&mut self, x: f32, y: f32, w: f32, h: f32, c: (f32, f32, f32)) {
        let l = self.l();
        l.set_outline_color(rgb(c));
        l.set_outline_thickness(0.4);
        for (a, b) in [
            (Point::new(Mm(x), Mm(y)), Point::new(Mm(x + w), Mm(y))),
            (
                Point::new(Mm(x + w), Mm(y)),
                Point::new(Mm(x + w), Mm(y + h)),
            ),
            (
                Point::new(Mm(x + w), Mm(y + h)),
                Point::new(Mm(x), Mm(y + h)),
            ),
            (Point::new(Mm(x), Mm(y + h)), Point::new(Mm(x), Mm(y))),
        ] {
            let line: Line = vec![(a, false), (b, false)].into_iter().collect();
            l.add_line(line);
        }
    }

    fn hline(&mut self, x1: f32, x2: f32, y: f32, c: (f32, f32, f32)) {
        let l = self.l();
        l.set_outline_color(rgb(c));
        l.set_outline_thickness(0.4);
        let line: Line = vec![
            (Point::new(Mm(x1), Mm(y)), false),
            (Point::new(Mm(x2), Mm(y)), false),
        ]
        .into_iter()
        .collect();
        l.add_line(line);
    }

    /// Section heading: bold title + short colored underline.
    fn heading(&mut self, title: &str, c: (f32, f32, f32)) {
        self.ensure(16.0);
        self.y -= 4.0;
        self.text_bold(13.0, title, 20.0);
        self.y += 1.0;
        self.rect(20.0, self.y - 1.2, 36.0, 1.0, c);
        self.y -= 5.0;
    }

    /// A row of KPI cards.
    fn kpi_row(&mut self, items: &[(&str, String)]) {
        let card_h = 18.0;
        let card_w = 40.5;
        let gap = 3.0;
        self.ensure(card_h + 6.0);
        let top = self.y;
        for (i, (label, value)) in items.iter().enumerate() {
            let x = 20.0 + i as f32 * (card_w + gap);
            self.rect(x, top - card_h + 1.0, card_w, card_h - 2.0, CARD);
            self.rect_outline(x, top - card_h + 1.0, card_w, card_h - 2.0, BORDER);
            let l = self.l();
            l.set_fill_color(rgb(MUTED));
            let _ = l.use_text(*label, 7.5, Mm(x + 3.0), Mm(top - 6.0), &self.font);
            l.set_fill_color(rgb(INK));
            let _ = l.use_text(value, 12.5, Mm(x + 3.0), Mm(top - 13.5), &self.font_bold);
        }
        self.y = top - card_h - 3.0;
    }

    /// Monthly revenue (red) vs expenses (teal) bar chart.
    fn bar_chart(&mut self, monthly: &[Value]) {
        let chart_h = 52.0;
        let chart_w = 170.0;
        let x0 = 20.0;
        self.ensure(chart_h + 22.0);
        let base = self.y - chart_h - 4.0;
        let max = monthly.iter().fold(1.0f64, |m, mo| {
            m.max(mo["net_revenue"].as_f64().unwrap_or(0.0))
                .max(mo["total_expenses"].as_f64().unwrap_or(0.0))
        }) as f32;
        let n = monthly.len().max(1) as f32;
        let group = chart_w / n;
        for (i, mo) in monthly.iter().enumerate() {
            let x = x0 + i as f32 * group;
            let rev = mo["net_revenue"].as_f64().unwrap_or(0.0) as f32;
            let exp = mo["total_expenses"].as_f64().unwrap_or(0.0) as f32;
            let rev_h = (rev / max) * chart_h;
            let exp_h = (exp / max) * chart_h;
            let bar_w = (group * 0.36).min(6.0);
            if rev_h > 0.0 {
                self.rect(x + 1.0, base, bar_w, rev_h, PRIMARY);
            }
            if exp_h > 0.0 {
                self.rect(x + 1.0 + bar_w + 1.5, base, bar_w, exp_h, TEAL);
            }
            let l = self.l();
            l.set_fill_color(rgb(MUTED));
            let _ = l.use_text(
                &format!("{}", mo["month"].as_i64().unwrap_or(0)),
                6.0,
                Mm(x + 2.0),
                Mm(base - 4.0),
                &self.font,
            );
        }
        self.hline(x0, x0 + chart_w, base, BORDER);
        self.y = base - 8.0;
    }

    /// A simple table with a shaded header row and zebra rows.
    fn table(&mut self, headers: &[&str], rows: &[Vec<String>], widths: &[f32]) {
        if rows.is_empty() {
            self.text(9.0, "No data for this period.", 20.0);
            self.y -= 2.0;
            return;
        }
        let row_h = 5.2;
        self.ensure(10.0 + rows.len() as f32 * row_h);
        let top = self.y;
        self.rect(
            20.0,
            top - row_h - 1.5,
            170.0,
            row_h + 3.0,
            (0.88, 0.90, 0.93),
        );
        let mut x = 20.0;
        let l = self.l();
        l.set_fill_color(rgb(INK));
        for (i, h) in headers.iter().enumerate() {
            let _ = l.use_text(*h, 8.0, Mm(x + 1.5), Mm(top - row_h - 1.5), &self.font_bold);
            x += widths[i];
        }
        self.y = top - row_h - 4.0;
        for (ri, row) in rows.iter().enumerate() {
            let l = self.l();
            l.set_fill_color(rgb(if ri % 2 == 0 { INK } else { MUTED }));
            let mut x = 20.0;
            for (ci, cell) in row.iter().enumerate() {
                let _ = l.use_text(cell, 8.0, Mm(x + 1.5), Mm(self.y), &self.font);
                x += widths[ci];
            }
            self.hline(20.0, 190.0, self.y - 0.3, BORDER);
            self.y -= row_h;
        }
        self.y -= 2.0;
    }
}

/// Render the portfolio report JSON to a structured A4 PDF.
pub fn render_portfolio_pdf(report: &Value) -> Result<Vec<u8>, String> {
    let (doc, page1, layer1) = PdfDocument::new("HostWise Report", Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;

    let mut r = Render::new(doc, font, font_bold, page1, layer1);
    r.footer();

    // ── Cover ────────────────────────────────────────────
    r.rect(0.0, 282.0, 210.0, 15.0, PRIMARY);
    {
        let l = r.l();
        l.set_fill_color(rgb(WHITE));
        let _ = l.use_text(
            "HostWise — Portfolio Report",
            16.0,
            Mm(20.0),
            Mm(293.0),
            &r.font_bold,
        );
    }
    r.y = 276.0;
    let period = format!(
        "{} → {}",
        report["period_start"].as_str().unwrap_or(""),
        report["period_end"].as_str().unwrap_or("")
    );
    r.text(10.5, &format!("Period: {period}"), 20.0);
    r.text(
        8.5,
        &format!(
            "Generated: {}  ·  Currency: {}",
            report["generated_at"].as_str().unwrap_or(""),
            report["currency"].as_str().unwrap_or("EUR")
        ),
        20.0,
    );
    r.y -= 6.0;

    // ── Executive Summary ────────────────────────────────
    r.heading("Executive Summary", PRIMARY);
    let exec = &report["executive_summary"];
    let es_gross = exec["gross_revenue"].as_f64().unwrap_or(0.0);
    let es_profit = exec["net_profit"].as_f64().unwrap_or(0.0);
    let es_margin = exec["profit_margin"].as_f64().unwrap_or(0.0);
    let es_count = exec["property_count"].as_i64().unwrap_or(0);
    let es_health = exec["portfolio_health_score"].as_f64();
    let es_status = exec["portfolio_health_status"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let exec_para = format!(
        "The period closed with {g} gross revenue and a net profit of {p} ({m:.1}% margin) across {c} propert{plural}. Portfolio health is {h}.",
        g = money(&Value::from(es_gross)),
        p = money(&Value::from(es_profit)),
        m = es_margin,
        c = es_count,
        plural = if es_count == 1 { "y" } else { "ies" },
        h = match es_health {
            Some(hs) => format!("{hs:.0}/100 ({es_status})"),
            None => "not scored yet".to_string(),
        },
    );
    for line in wrap(&exec_para, 92) {
        r.ensure(6.0);
        r.text(9.5, &line, 20.0);
    }
    r.y -= 4.0;

    // KPI cards
    let kpis = &report["kpis"];
    r.kpi_row(&[
        ("Gross Revenue", money(&kpis["gross_revenue"])),
        ("Net Revenue", money(&kpis["net_revenue"])),
        ("Profit", money(&kpis["profit"])),
        (
            "Profit Margin",
            format!("{:.1}%", kpis["profit_margin"].as_f64().unwrap_or(0.0)),
        ),
    ]);
    r.kpi_row(&[
        ("Total Expenses", money(&kpis["total_expenses"])),
        (
            "Cancellations",
            format!("{:.1}%", kpis["cancellation_rate"].as_f64().unwrap_or(0.0)),
        ),
        (
            "Reservations",
            kpis["reservation_count"].as_i64().unwrap_or(0).to_string(),
        ),
        ("Nights", kpis["nights"].as_i64().unwrap_or(0).to_string()),
    ]);
    r.y -= 4.0;

    // ── AI Executive Insights ────────────────────────────
    let ai = &report["ai_insights"];
    if let Some(summary) = ai.get("summary").and_then(|v| v.as_str()) {
        if !summary.is_empty() {
            r.heading("AI Executive Insights", GREEN);
            for line in wrap(summary, 92) {
                r.ensure(6.0);
                r.text(9.5, &line, 20.0);
            }
            if let Some(drivers) = ai.get("drivers").and_then(|v| v.as_array()) {
                if !drivers.is_empty() {
                    r.y -= 2.0;
                    r.text_bold(9.0, "What drove the change:", 20.0);
                    for d in drivers.iter().take(3) {
                        let line = format!(
                            "• {} — {}",
                            d["label"].as_str().unwrap_or(""),
                            d["detail"].as_str().unwrap_or("")
                        );
                        for wrapped in wrap(&line, 92) {
                            r.ensure(6.0);
                            r.text(9.0, &wrapped, 24.0);
                        }
                    }
                }
            }
        }
    }

    // Risk / recommendation callout boxes.
    let risk = ai.get("biggest_risk");
    let rec = ai.get("recommendation").and_then(|v| v.as_str());
    if risk.is_some() || rec.is_some() {
        r.ensure(34.0);
        r.y -= 4.0;
        let top = r.y;
        let risk_title = risk
            .and_then(|v| v.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let risk_cause = risk
            .and_then(|v| v.get("cause"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if !risk_title.is_empty() {
            r.rect(20.0, top - 30.0, 92.0, 29.0, (0.98, 0.94, 0.94));
            r.rect_outline(20.0, top - 30.0, 92.0, 29.0, RED);
            let l = r.l();
            l.set_fill_color(rgb(RED));
            let _ = l.use_text("BIGGEST RISK", 7.0, Mm(23.0), Mm(top - 4.0), &r.font_bold);
            l.set_fill_color(rgb(INK));
            let _ = l.use_text(risk_title, 9.0, Mm(23.0), Mm(top - 10.0), &r.font_bold);
            let mut cy = top - 16.0;
            for line in wrap(risk_cause, 44).iter().take(3) {
                let l = r.l();
                l.set_fill_color(rgb(MUTED));
                let _ = l.use_text(line, 7.5, Mm(23.0), Mm(cy), &r.font);
                cy -= 3.6;
            }
        }
        if let Some(rec) = rec {
            if !rec.is_empty() {
                r.rect(118.0, top - 30.0, 92.0, 29.0, (0.94, 0.98, 0.95));
                r.rect_outline(118.0, top - 30.0, 92.0, 29.0, GREEN);
                let l = r.l();
                l.set_fill_color(rgb(GREEN));
                let _ = l.use_text(
                    "RECOMMENDATION",
                    7.0,
                    Mm(121.0),
                    Mm(top - 4.0),
                    &r.font_bold,
                );
                l.set_fill_color(rgb(INK));
                let mut cy = top - 10.0;
                for line in wrap(rec, 44).iter().take(4) {
                    let l = r.l();
                    l.set_fill_color(rgb(INK));
                    let _ = l.use_text(line, 7.5, Mm(121.0), Mm(cy), &r.font);
                    cy -= 3.6;
                }
            }
        }
        r.y = top - 34.0;
    }

    // ── Monthly chart ────────────────────────────────────
    if let Some(monthly) = report["monthly_breakdown"].as_array() {
        if !monthly.is_empty() {
            r.heading("Monthly Revenue vs Expenses", TEAL);
            r.bar_chart(monthly);
            r.y -= 2.0;
            let l = r.l();
            l.set_fill_color(rgb(PRIMARY));
            let _ = l.use_text("■ Net revenue", 8.0, Mm(20.0), Mm(r.y), &r.font);
            l.set_fill_color(rgb(TEAL));
            let _ = l.use_text("   ■ Expenses", 8.0, Mm(48.0), Mm(r.y), &r.font);
            r.y -= 5.0;
        }
    }

    // ── Property performance ─────────────────────────────
    r.heading("Property Performance", PRIMARY);
    let mut prop_rows: Vec<Vec<String>> = Vec::new();
    if let Some(props) = report["property_performance"].as_array() {
        for p in props.iter().take(10) {
            prop_rows.push(vec![
                p["property_name"].as_str().unwrap_or("").to_string(),
                money(&p["net_revenue"]),
                money(&p["total_expenses"]),
                money(&p["profit"]),
                format!("{:.1}%", p["profit_margin"].as_f64().unwrap_or(0.0)),
                p["reservation_count"].as_i64().unwrap_or(0).to_string(),
                p["health_score"].as_i64().unwrap_or(0).to_string(),
            ]);
        }
    }
    r.table(
        &[
            "Property", "Net", "Expenses", "Profit", "Margin", "Res", "Health",
        ],
        &prop_rows,
        &[50.0, 26.0, 28.0, 26.0, 22.0, 14.0, 18.0],
    );

    // ── Expense analysis ─────────────────────────────────
    r.heading("Expense Analysis", AMBER);
    let mut exp_rows: Vec<Vec<String>> = Vec::new();
    if let Some(cats) = report["expense_analysis"]["categories"].as_array() {
        for c in cats.iter().take(10) {
            exp_rows.push(vec![
                c["category_name"].as_str().unwrap_or("").to_string(),
                money(c.get("total").unwrap_or(&Value::Null)),
                format!("{:.1}%", c["percentage"].as_f64().unwrap_or(0.0)),
                c["count"].as_i64().unwrap_or(0).to_string(),
            ]);
        }
    }
    r.table(
        &["Category", "Total", "Share", "Entries"],
        &exp_rows,
        &[84.0, 42.0, 32.0, 24.0],
    );

    // ── Risks ────────────────────────────────────────────
    r.heading("Risks", RED);
    if let Some(risks) = report["risks"].as_array() {
        if risks.is_empty() {
            r.text(9.0, "No significant risks were detected.", 20.0);
            r.y -= 2.0;
        }
        for risk in risks.iter().take(6) {
            let title = risk["title"].as_str().unwrap_or("");
            let detail = risk["detail"].as_str().unwrap_or("");
            let lvl = risk["level"].as_str().unwrap_or("medium");
            r.ensure(12.0);
            let c = if lvl == "high" { RED } else { AMBER };
            let l = r.l();
            l.set_fill_color(rgb(c));
            let _ = l.use_text(
                lvl.to_uppercase().as_str(),
                7.0,
                Mm(20.0),
                Mm(r.y),
                &r.font_bold,
            );
            l.set_fill_color(rgb(INK));
            let _ = l.use_text(title, 9.5, Mm(36.0), Mm(r.y), &r.font_bold);
            r.y -= 4.0;
            for line in wrap(detail, 88) {
                r.ensure(5.0);
                r.text(8.5, &line, 36.0);
            }
            r.y -= 2.0;
        }
    }

    // ── Recommended actions ──────────────────────────────
    r.heading("Recommended Actions", PRIMARY);
    if let Some(recs) = report["recommendations"].as_array() {
        if recs.is_empty() {
            r.text(9.0, "No recommendations for this period.", 20.0);
            r.y -= 2.0;
        }
        for rec in recs.iter().take(8) {
            let typ = rec["type"].as_str().unwrap_or("");
            let title = rec["title"].as_str().unwrap_or("");
            let action = rec["suggested_action"].as_str().unwrap_or("");
            r.ensure(10.0);
            let c = match typ {
                "critical" => RED,
                "warning" => AMBER,
                _ => GREEN,
            };
            let l = r.l();
            l.set_fill_color(rgb(c));
            let _ = l.use_text(
                format!("[{}]", typ.to_uppercase()).as_str(),
                7.0,
                Mm(20.0),
                Mm(r.y),
                &r.font_bold,
            );
            l.set_fill_color(rgb(INK));
            let _ = l.use_text(title, 9.5, Mm(42.0), Mm(r.y), &r.font_bold);
            r.y -= 4.0;
            for line in wrap(action, 84) {
                r.ensure(5.0);
                r.text(8.5, &line, 42.0);
            }
            r.y -= 2.0;
        }
    }

    use std::io::BufWriter;
    let mut bytes = Vec::new();
    {
        let mut writer = BufWriter::new(&mut bytes);
        r.doc.save(&mut writer).map_err(|e| e.to_string())?;
    }
    Ok(bytes)
}
