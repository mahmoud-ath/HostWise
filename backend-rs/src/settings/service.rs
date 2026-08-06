//! Settings service, mirroring `backend/app/settings/service.py` +
//! `backend/app/settings/defaults.py`.
//!
//! Defaults are merged with stored values so the store stays minimal. Values
//! are JSON-encoded. The AI API key is masked on read and masked placeholders
//! are ignored on write so the client never clobbers the stored secret.

use std::collections::HashMap;

use serde_json::{Map, Value};
use sqlx::SqlitePool;

use crate::core::error::AppError;
use crate::core::time::now_iso;
use crate::settings::models::SettingRow;

const MASK_FULL: &str = "••••••••";
const API_KEY_KEY: &str = "ai_api_key";

const BOOL_KEYS: &[&str] = &[
    "ai_enabled",
    "notify_profit_drops",
    "notify_revenue_increase",
    "notify_occupancy_falls",
    "notify_backup_completed",
    "notify_monthly_report",
    "appearance_compact",
    "appearance_animations",
    "dashboard_show_ai_summary",
    "dashboard_show_forecast",
    "report_send_email",
];

fn default_settings() -> Map<String, Value> {
    serde_json::from_str::<Map<String, Value>>(
        r#"{
      "profile_name": "", "profile_email": "", "business_name": "HostWise",
      "default_currency": "EUR", "tax_rate": 20.0, "fiscal_year_start": 1, "country": "",
      "timezone": "UTC", "date_format": "DD/MM/YYYY", "language": "English",
      "ai_enabled": true, "ai_provider": "hostwise", "ai_api_key": "",
      "ai_base_url": "https://api.openai.com/v1", "ai_model": "gpt-4o-mini",
      "ai_analysis_level": "detailed", "ai_automatic_analysis": "daily", "ai_language": "English",
      "notify_profit_drops": true, "notify_revenue_increase": true, "notify_occupancy_falls": true,
      "notify_backup_completed": true, "notify_monthly_report": true,
      "appearance_theme": "light", "appearance_accent": "default", "appearance_compact": false,
      "appearance_animations": true,
      "dashboard_default": "financial", "dashboard_show_ai_summary": true,
      "dashboard_show_forecast": true, "dashboard_default_year": "current",
      "import_encoding": "UTF-8", "import_delimiter": ",", "import_date_format": "DD/MM/YYYY",
      "report_default": "annual", "report_default_format": "pdf",
      "report_auto_generate": "monthly", "report_send_email": false
    }"#,
    )
    .expect("default settings JSON is valid")
}

fn check_enum(value: Value, allowed: &[&str], key: &str) -> Result<Value, AppError> {
    match value.as_str() {
        Some(s) if allowed.contains(&s) => Ok(Value::String(s.to_string())),
        _ => Err(AppError::Validation(format!(
            "invalid value for {key}; allowed: {}",
            allowed.join(", ")
        ))),
    }
}

fn check_number(value: Value, lo: f64, hi: f64, key: &str) -> Result<Value, AppError> {
    let n = value.as_f64().ok_or_else(|| {
        AppError::Validation(format!("{key} must be a number between {lo} and {hi}"))
    })?;
    if !(lo..=hi).contains(&n) {
        return Err(AppError::Validation(format!(
            "{key} must be between {lo} and {hi}"
        )));
    }
    serde_json::Number::from_f64(n)
        .map(Value::Number)
        .ok_or_else(|| AppError::Validation(format!("{key} is not a valid number")))
}

fn check_int(value: Value, lo: i64, hi: i64, key: &str) -> Result<Value, AppError> {
    let n = value.as_i64().ok_or_else(|| {
        AppError::Validation(format!("{key} must be an integer between {lo} and {hi}"))
    })?;
    if !(lo..=hi).contains(&n) {
        return Err(AppError::Validation(format!(
            "{key} must be between {lo} and {hi}"
        )));
    }
    Ok(Value::Number(n.into()))
}

fn coerce_bool(value: Value, key: &str) -> Result<Value, AppError> {
    let b = match value {
        Value::Bool(b) => b,
        Value::String(s) => match s.to_ascii_lowercase().as_str() {
            "true" | "1" => true,
            "false" | "0" => false,
            _ => return Err(AppError::Validation(format!("{key} must be a boolean"))),
        },
        Value::Number(n) => n
            .as_i64()
            .map(|i| i != 0)
            .ok_or_else(|| AppError::Validation(format!("{key} must be a boolean")))?,
        _ => return Err(AppError::Validation(format!("{key} must be a boolean"))),
    };
    Ok(Value::Bool(b))
}

/// Coerce/validate a single setting against the schema. Unknown keys pass
/// through unchanged (forward compatibility), mirroring SETTINGS_SCHEMA.
fn coerce_setting(key: &str, value: Value) -> Result<Value, AppError> {
    match key {
        "default_currency" => check_enum(
            value,
            &["USD", "EUR", "GBP", "MAD", "AED", "CAD", "AUD", "CHF"],
            key,
        ),
        "date_format" | "import_date_format" => {
            check_enum(value, &["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"], key)
        }
        "language" | "ai_language" => check_enum(
            value,
            &["English", "Français", "Español", "العربية", "Deutsch"],
            key,
        ),
        "ai_provider" => check_enum(
            value,
            &["hostwise", "openai", "deepseek", "anthropic", "ollama"],
            key,
        ),
        "ai_analysis_level" => check_enum(value, &["summary", "detailed", "expert"], key),
        "ai_automatic_analysis" => check_enum(value, &["daily", "weekly", "monthly", "off"], key),
        "appearance_theme" => check_enum(value, &["light", "dark", "system"], key),
        "import_encoding" => check_enum(
            value,
            &["UTF-8", "ISO-8859-1", "Windows-1252", "UTF-16"],
            key,
        ),
        "report_default_format" => check_enum(value, &["pdf", "print"], key),
        "report_auto_generate" => check_enum(value, &["off", "daily", "weekly", "monthly"], key),
        "tax_rate" => check_number(value, 0.0, 100.0, key),
        "fiscal_year_start" => check_int(value, 1, 12, key),
        k if BOOL_KEYS.contains(&k) => coerce_bool(value, key),
        _ => Ok(value),
    }
}

/// All settings: defaults merged with stored values (API key masked).
pub async fn get_all(pool: &SqlitePool) -> Result<Value, AppError> {
    let rows = sqlx::query_as::<_, SettingRow>("SELECT key, value, updated_at FROM settings")
        .fetch_all(pool)
        .await?;

    let mut merged = default_settings();
    for r in rows {
        let parsed: Value = serde_json::from_str(&r.value).unwrap_or(Value::Null);
        let value = if r.key == API_KEY_KEY {
            match parsed.as_str() {
                Some(s) if !s.is_empty() => Value::String(MASK_FULL.to_string()),
                Some(_) => Value::String(String::new()),
                None => parsed,
            }
        } else {
            parsed
        };
        merged.insert(r.key, value);
    }
    Ok(Value::Object(merged))
}

/// Upsert the given settings and return the full updated map.
pub async fn update(pool: &SqlitePool, settings: Map<String, Value>) -> Result<Value, AppError> {
    let now = now_iso();
    for (key, raw) in settings {
        if key == API_KEY_KEY {
            if let Some(s) = raw.as_str() {
                if s.is_empty() || s.starts_with("••") {
                    // Masked placeholder / empty -> keep the stored secret.
                    continue;
                }
            }
        }
        let value = coerce_setting(&key, raw)?;
        let encoded = serde_json::to_string(&value)?;
        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(&key)
        .bind(&encoded)
        .bind(&now)
        .execute(pool)
        .await?;
    }
    get_all(pool).await
}

/// Delete all business data (expenses, revenues, reservations, properties)
/// so the user can start fresh. Settings and profile are kept.
pub async fn wipe(pool: &SqlitePool) -> Result<(), AppError> {
    for table in ["expenses", "revenues", "reservations", "properties"] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(pool)
            .await?;
    }
    Ok(())
}

// ── Excel (.xls) export ───────────────────────────────────

fn csv_escape(v: &str) -> String {
    if v.contains('"') || v.contains(',') || v.contains('\n') {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_string()
    }
}

fn xls_table(headers: &[&str], rows: &[Vec<String>]) -> String {
    let thead: String = headers
        .iter()
        .map(|h| format!("<th>{}</th>", csv_escape(h)))
        .collect();
    let body: String = rows
        .iter()
        .map(|row| {
            let cells: String = row
                .iter()
                .map(|v| format!("<td>{}</td>", csv_escape(v)))
                .collect();
            format!("<tr>{cells}</tr>")
        })
        .collect();
    format!("<table><tr>{thead}</tr>{body}</table><br/>")
}

/// Export all business data as a multi-sheet Excel workbook (.xls), mirroring
/// `export_all_data` in `backend/app/settings/router.py`.
pub async fn export_data(pool: &SqlitePool) -> Result<String, AppError> {
    let props = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            i64,
            f64,
            String,
        ),
    >(
        "SELECT id, name, type, city, country, bedrooms, bathrooms, status \
         FROM properties WHERE is_deleted = 0",
    )
    .fetch_all(pool)
    .await?;
    let prop_by_id: HashMap<String, String> =
        props.iter().map(|p| (p.0.clone(), p.1.clone())).collect();

    let prop_rows: Vec<Vec<String>> = props
        .iter()
        .map(|(_, name, ty, city, country, beds, baths, status)| {
            vec![
                name.clone(),
                ty.clone(),
                city.clone().unwrap_or_default(),
                country.clone().unwrap_or_default(),
                beds.to_string(),
                baths.to_string(),
                status.clone(),
            ]
        })
        .collect();

    let revenues = sqlx::query_as::<_, (String, String, f64, f64, f64, String, Option<String>)>(
        "SELECT date, property_id, gross_amount, commission_amount, net_amount, currency, description \
         FROM revenues WHERE is_deleted = 0",
    )
    .fetch_all(pool)
    .await?;
    let rev_rows: Vec<Vec<String>> = revenues
        .iter()
        .map(|(d, pid, g, c, n, cur, desc)| {
            vec![
                d.clone(),
                prop_by_id.get(pid).cloned().unwrap_or_default(),
                g.to_string(),
                c.to_string(),
                n.to_string(),
                cur.clone(),
                desc.clone().unwrap_or_default(),
            ]
        })
        .collect();

    let expenses = sqlx::query_as::<
        _,
        (
            String,
            String,
            f64,
            String,
            Option<String>,
            Option<String>,
            bool,
        ),
    >(
        "SELECT date, property_id, amount, currency, vendor, description, is_recurring \
         FROM expenses WHERE is_deleted = 0",
    )
    .fetch_all(pool)
    .await?;
    let exp_rows: Vec<Vec<String>> = expenses
        .iter()
        .map(|(d, pid, amt, cur, vendor, desc, rec)| {
            vec![
                d.clone(),
                prop_by_id.get(pid).cloned().unwrap_or_default(),
                amt.to_string(),
                cur.clone(),
                vendor.clone().unwrap_or_default(),
                desc.clone().unwrap_or_default(),
                if *rec {
                    "yes".to_string()
                } else {
                    "no".to_string()
                },
            ]
        })
        .collect();

    let reservations = sqlx::query_as::<_, (String, String, String, String, Option<String>, i64, f64, f64, String)>(
        "SELECT check_in, check_out, property_id, status, guest_name, nights, gross_revenue, net_revenue, currency \
         FROM reservations WHERE is_deleted = 0",
    )
    .fetch_all(pool)
    .await?;
    let res_rows: Vec<Vec<String>> = reservations
        .iter()
        .map(|(ci, co, pid, status, guest, nights, gross, net, cur)| {
            vec![
                ci.clone(),
                co.clone(),
                prop_by_id.get(pid).cloned().unwrap_or_default(),
                status.clone(),
                guest.clone().unwrap_or_default(),
                nights.to_string(),
                gross.to_string(),
                net.to_string(),
                cur.clone(),
            ]
        })
        .collect();

    let sheets = [
        (
            "Properties",
            vec![
                "Name",
                "Type",
                "City",
                "Country",
                "Bedrooms",
                "Bathrooms",
                "Status",
            ],
            prop_rows,
        ),
        (
            "Revenue",
            vec![
                "Date",
                "Property",
                "Gross",
                "Commission",
                "Net",
                "Currency",
                "Description",
            ],
            rev_rows,
        ),
        (
            "Expenses",
            vec![
                "Date",
                "Property",
                "Amount",
                "Currency",
                "Vendor",
                "Description",
                "Recurring",
            ],
            exp_rows,
        ),
        (
            "Reservations",
            vec![
                "Check In",
                "Check Out",
                "Property",
                "Status",
                "Guest",
                "Nights",
                "Gross",
                "Net",
                "Currency",
            ],
            res_rows,
        ),
    ];

    let sheet_xml: String = sheets
        .iter()
        .map(|(name, _, _)| {
            format!(
                "<x:ExcelWorksheet><x:Name>{}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>",
                csv_escape(name)
            )
        })
        .collect();
    let tables: String = sheets
        .iter()
        .map(|(_, headers, rows)| xls_table(headers, rows))
        .collect();

    Ok(format!(
        "<html xmlns:x=\"urn:schemas-microsoft-com:office:excel\"><head><meta charset=\"utf-8\">\
         <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>{sheet_xml}</x:ExcelWorksheets>\
         </x:ExcelWorkbook></xml><![endif]-->\
         <style>td,th{{border:1px solid #ccc;padding:4px 8px;}}th{{background:#f5f5f5;}}</style>\
         </head><body>{tables}</body></html>"
    ))
}
