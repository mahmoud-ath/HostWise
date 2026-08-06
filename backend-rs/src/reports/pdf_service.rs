//! Pure-Rust PDF rendering via `printpdf` — no external runtime.
//! Replaces the WeasyPrint (GTK/Pango) PDF export so the desktop app can
//! generate real PDFs on every platform with no native dependencies.

use printpdf::{BuiltinFont, Mm, PdfDocument};
use serde_json::Value;

fn money(v: &Value) -> String {
    format!("{:.0}", v.as_f64().unwrap_or(0.0))
}

fn text(
    layer: &printpdf::PdfLayerReference,
    font: &printpdf::IndirectFontRef,
    size: f32,
    s: &str,
    y: &mut f32,
) {
    let _ = layer.use_text(s, size, Mm(20.0), Mm(*y), font);
    *y -= size * 0.55;
}

/// Render the portfolio report JSON to a PDF document (A4).
pub fn render_portfolio_pdf(report: &Value) -> Result<Vec<u8>, String> {
    let (doc, page1, layer1) = PdfDocument::new("HostWise Report", Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;
    let layer = doc.get_page(page1).get_layer(layer1);

    let mut y: f32 = 278.0;

    // Cover
    text(&layer, &font_bold, 22.0, "HostWise — Portfolio Report", &mut y);
    let period = format!(
        "{} → {}",
        report["period_start"].as_str().unwrap_or(""),
        report["period_end"].as_str().unwrap_or("")
    );
    text(&layer, &font, 12.0, &format!("Period: {period}"), &mut y);
    text(
        &layer,
        &font,
        10.0,
        &format!(
            "Generated: {}  ·  Currency: {}",
            report["generated_at"].as_str().unwrap_or(""),
            report["currency"].as_str().unwrap_or("EUR")
        ),
        &mut y,
    );
    y -= 6.0;

    // Executive summary
    text(&layer, &font_bold, 13.0, "Executive Summary", &mut y);
    let exec = report["executive_summary"].as_str().unwrap_or("");
    for line in exec.split_terminator(". ") {
        text(&layer, &font, 10.0, &format!("• {line}."), &mut y);
    }
    y -= 6.0;

    // KPIs
    text(&layer, &font_bold, 13.0, "Key Performance Indicators", &mut y);
    let kpis = &report["kpis"];
    text(&layer, &font, 11.0, &format!("Net revenue:  {}", money(&kpis["net_revenue"])), &mut y);
    text(&layer, &font, 11.0, &format!("Gross revenue: {}", money(&kpis["gross_revenue"])), &mut y);
    text(&layer, &font, 11.0, &format!("Total expenses: {}", money(&kpis["total_expenses"])), &mut y);
    text(&layer, &font, 11.0, &format!("Profit:  {}", money(&kpis["profit"])), &mut y);
    text(&layer, &font, 11.0, &format!("Profit margin:  {:.1}%", kpis["profit_margin"].as_f64().unwrap_or(0.0)), &mut y);
    text(&layer, &font, 11.0, &format!("Cancellation rate: {:.1}%", kpis["cancellation_rate"].as_f64().unwrap_or(0.0)), &mut y);
    text(&layer, &font, 11.0, &format!("Reservations: {}  ·  Nights: {}", kpis["reservation_count"], kpis["nights"]), &mut y);
    y -= 6.0;

    // Properties
    text(&layer, &font_bold, 13.0, "Properties", &mut y);
    if let Some(rows) = report["property_table"].as_array() {
        for r in rows {
            let line = format!(
                "{} — net {} — expenses {} — profit {}",
                r["name"].as_str().unwrap_or("Unknown"),
                money(&r["net_revenue"]),
                money(&r["expenses"]),
                money(&r["profit"])
            );
            text(&layer, &font, 10.0, &line, &mut y);
            if y < 40.0 {
                break;
            }
        }
    }
    y -= 6.0;

    // Risks & recommendations
    text(&layer, &font_bold, 13.0, "Risks", &mut y);
    if let Some(risks) = report["risks"].as_array() {
        for r in risks {
            let line = format!("• {}", r["risk"].as_str().unwrap_or(""));
            text(&layer, &font, 10.0, &line, &mut y);
            if y < 40.0 {
                break;
            }
        }
    }
    y -= 6.0;

    text(&layer, &font_bold, 13.0, "Recommended Actions", &mut y);
    if let Some(recs) = report["recommendations"].as_array() {
        for r in recs.iter().take(6) {
            let line = format!("• [{}] {}", r["type"].as_str().unwrap_or(""), r["title"].as_str().unwrap_or(""));
            text(&layer, &font, 10.0, &line, &mut y);
            if y < 40.0 {
                break;
            }
        }
    }

    // Footer
    y = 12.0;
    text(&layer, &font, 8.0, "HostWise — Confidential", &mut y);

    use std::io::BufWriter;
    let mut bytes = Vec::new();
    {
        let mut writer = BufWriter::new(&mut bytes);
        doc.save(&mut writer).map_err(|e| e.to_string())?;
    }
    Ok(bytes)
}
