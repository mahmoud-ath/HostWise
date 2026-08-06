//! Connectors service: CSV/JSON preview + import, and iCal import.
//! Mirrors `backend/app/connectors/service.py`.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use chrono::NaiveDate;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::connectors::ical;
use crate::core::error::AppError;
use crate::core::time::now_iso;
use crate::finance::models::{Expense, Revenue};
use crate::finance::repository as finance_repo;
use crate::properties::models::Property;
use crate::properties::repository as props_repo;
use crate::reservations::models::Reservation;
use crate::reservations::repository as res_repo;
use crate::settings::service as settings;

fn get<'a>(row: &'a HashMap<String, String>, keys: &[&str]) -> &'a str {
    for k in keys {
        if let Some(v) = row.get(*k) {
            if !v.trim().is_empty() {
                return v;
            }
        }
    }
    ""
}

fn read_bytes_lossy(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let content = String::from_utf8_lossy(&bytes).to_string();
    Ok(content
        .strip_prefix('\u{feff}')
        .unwrap_or(&content)
        .to_string())
}

/// Read a CSV file into (columns, rows of string values).
fn read_csv(
    path: &Path,
    delimiter: u8,
) -> Result<(Vec<String>, Vec<HashMap<String, String>>), String> {
    let content = read_bytes_lossy(path)?;
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(true)
        .from_reader(content.as_bytes());
    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| e.to_string())?
        .iter()
        .map(|s| s.trim().to_lowercase())
        .collect();
    let mut rows = Vec::new();
    for rec in reader.records() {
        let rec = rec.map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        for (i, h) in headers.iter().enumerate() {
            map.insert(h.clone(), rec.get(i).unwrap_or("").to_string());
        }
        rows.push(map);
    }
    Ok((headers, rows))
}

/// Read a JSON file (array of objects or `{type, rows}`) into rows.
fn read_json(path: &Path) -> Result<(Vec<String>, Vec<HashMap<String, String>>), String> {
    let content = read_bytes_lossy(path)?;
    let v: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let arr: Vec<Value> = match &v {
        Value::Array(a) => a.clone(),
        Value::Object(o) => o
            .get("rows")
            .and_then(|r| r.as_array())
            .cloned()
            .ok_or("JSON must be an array of objects or {type, rows}")?,
        _ => return Err("JSON must be an array of objects or {type, rows}".into()),
    };
    let mut cols: Vec<String> = Vec::new();
    for r in &arr {
        if let Value::Object(o) = r {
            for k in o.keys() {
                if !cols.contains(k) {
                    cols.push(k.clone());
                }
            }
        }
    }
    let mut rows = Vec::new();
    for r in &arr {
        if let Value::Object(o) = r {
            let mut map = HashMap::new();
            for (k, val) in o {
                map.insert(
                    k.clone(),
                    val.as_str()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| val.to_string()),
                );
            }
            rows.push(map);
        }
    }
    Ok((cols, rows))
}

/// Read a file, returning (format, columns, rows).
pub fn read_file(
    path: &Path,
    _encoding: Option<&str>,
    delimiter: Option<&str>,
) -> Result<(String, Vec<String>, Vec<HashMap<String, String>>), String> {
    let is_json = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("json"))
        .unwrap_or(false);
    if is_json {
        let (cols, rows) = read_json(path)?;
        return Ok(("json".into(), cols, rows));
    }
    let delim = delimiter.unwrap_or(",");
    let delim_byte = delim.as_bytes().first().copied().unwrap_or(b',');
    let (cols, rows) = read_csv(path, delim_byte)?;
    Ok(("csv".into(), cols, rows))
}

/// Auto-detect import type from column names.
pub fn detect_type(import_type: &str, columns: &[String]) -> String {
    if import_type != "auto" {
        return import_type.to_string();
    }
    let cols = columns.join(" ");
    if (cols.contains("gross_revenue") || cols.contains("gross_amount"))
        && cols.contains("reservation_id")
    {
        return "revenues".into();
    }
    if cols.contains("check_in") && cols.contains("check_out") {
        return "reservations".into();
    }
    if (cols.contains("expense") || cols.contains("category")) && cols.contains("amount") {
        return "expenses".into();
    }
    "reservations".into()
}

/// Parse a date honoring the configured import date format.
fn parse_date(value: &str, fmt: &str) -> Result<NaiveDate, String> {
    let v = value.trim();
    if v.is_empty() {
        return Err("empty date".into());
    }
    let candidates: &[&str] = match fmt {
        "DD/MM/YYYY" => &["%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"],
        "MM/DD/YYYY" => &["%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"],
        _ => &["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"],
    };
    for c in candidates {
        if let Ok(d) = NaiveDate::parse_from_str(v, c) {
            return Ok(d);
        }
    }
    Err(format!("unparseable date: {v}"))
}

/// Find or create a property; returns (id, created).
async fn resolve_property(
    pool: &SqlitePool,
    prop_map: &mut HashMap<String, String>,
    existing_props: &mut HashMap<String, String>,
    csv_pid: &str,
    prop_name: &str,
    city: &str,
    country: &str,
) -> Result<(Option<String>, bool), AppError> {
    let csv_pid = csv_pid.trim();
    let prop_name = prop_name.trim();

    if !csv_pid.is_empty() && prop_map.contains_key(csv_pid) {
        return Ok((Some(prop_map[csv_pid].clone()), false));
    }
    if !prop_name.is_empty() {
        let key = prop_name.to_lowercase();
        if let Some(id) = existing_props.get(&key) {
            prop_map.insert(csv_pid.to_string(), id.clone());
            return Ok((Some(id.clone()), false));
        }
    }

    let name = if prop_name.is_empty() {
        let suffix = if csv_pid.is_empty() {
            Uuid::new_v4().simple().to_string()[..6].to_string()
        } else {
            csv_pid.chars().take(8).collect()
        };
        format!("Imported {suffix}")
    } else {
        prop_name.to_string()
    };

    let now = now_iso();
    let id = Uuid::new_v4().to_string();
    let property = Property {
        id: id.clone(),
        name: name.clone(),
        r#type: "other".into(),
        status: "active".into(),
        address: None,
        city: if city.trim().is_empty() {
            None
        } else {
            Some(city.trim().to_string())
        },
        state: None,
        country: if country.trim().is_empty() {
            None
        } else {
            Some(country.trim().to_string())
        },
        postal_code: None,
        latitude: None,
        longitude: None,
        bedrooms: 1,
        bathrooms: 1.0,
        max_guests: 2,
        square_meters: None,
        acquisition_cost: None,
        monthly_mortgage: None,
        target_occupancy: None,
        target_annual_revenue: None,
        notes: None,
        deleted_at: None,
        created_at: now.clone(),
        updated_at: now,
        sync_id: None,
    };
    props_repo::insert(pool, &property).await?;
    prop_map.insert(csv_pid.to_string(), id.clone());
    existing_props.insert(name.to_lowercase(), id.clone());
    Ok((Some(id), true))
}

/// Find or create an expense category by name (case-insensitive).
async fn resolve_expense_category(
    pool: &SqlitePool,
    cache: &mut HashMap<String, String>,
    name: &str,
) -> Result<Option<String>, AppError> {
    let key = name.trim().to_lowercase();
    if key.is_empty() {
        return Ok(None);
    }
    if let Some(id) = cache.get(&key) {
        return Ok(Some(id.clone()));
    }
    let id = finance_repo::find_or_create_expense_category(pool, name).await?;
    cache.insert(key, id.clone());
    Ok(Some(id))
}

/// Import a previously-uploaded CSV/JSON file into the database.
pub async fn import_file(
    pool: &SqlitePool,
    file_path: &Path,
    import_type: &str,
) -> Result<Value, AppError> {
    let all = settings::get_all(pool).await?;
    let date_fmt = all["import_date_format"].as_str().unwrap_or("DD/MM/YYYY");
    let currency = all["default_currency"].as_str().unwrap_or("EUR");
    let enc = all["import_encoding"].as_str().unwrap_or("UTF-8");
    let delim = all["import_delimiter"].as_str().unwrap_or(",");

    let (fmt, columns, rows) =
        read_file(file_path, Some(enc), Some(delim)).map_err(AppError::Validation)?;
    if rows.is_empty() {
        return Ok(json!({
            "import_type": import_type, "imported": 0, "skipped": 0,
            "properties_created": 0, "errors": ["File is empty."],
        }));
    }

    let existing: Vec<(String, String)> =
        sqlx::query_as("SELECT id, name FROM properties WHERE is_deleted = 0")
            .fetch_all(pool)
            .await?;
    let mut existing_props: HashMap<String, String> = HashMap::new();
    for (id, name) in &existing {
        existing_props.insert(name.to_lowercase(), id.clone());
    }
    let mut prop_map: HashMap<String, String> = HashMap::new();
    let mut props_created: i64 = 0;

    let mut exp_cat_cache: HashMap<String, String> = HashMap::new();
    let existing_cats: Vec<(String, String)> =
        sqlx::query_as("SELECT id, name FROM expense_categories WHERE is_deleted = 0")
            .fetch_all(pool)
            .await?;
    for (id, name) in &existing_cats {
        exp_cat_cache.insert(name.to_lowercase(), id.clone());
    }

    let detected = detect_type(import_type, &columns);

    // Idempotency sets (natural keys, mirrors the Python service).
    let mut existing_res_codes: HashSet<String> = sqlx::query_scalar(
        "SELECT confirmation_code FROM reservations WHERE is_deleted = 0 AND confirmation_code IS NOT NULL",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .collect();
    let mut existing_rev_keys: HashSet<String> = sqlx::query_as::<_, (String, String, f64, f64, String)>(
        "SELECT property_id, date, gross_amount, net_amount, source FROM revenues WHERE is_deleted = 0",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|(p, d, g, n, s)| format!("{p}|{d}|{g:.4}|{n:.4}|{s}"))
    .collect();
    let mut existing_exp_keys: HashSet<String> = sqlx::query_as::<_, (String, String, f64, String, String)>(
        "SELECT property_id, date, amount, COALESCE(vendor,''), COALESCE(description,'') FROM expenses WHERE is_deleted = 0",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|(p, d, a, v, c)| format!("{p}|{d}|{a:.4}|{v}|{c}"))
    .collect();

    let mut imported: i64 = 0;
    let mut skipped: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    if detected == "reservations" {
        for row in &rows {
            let outcome: Result<bool, AppError> = async {
                let (prop_id, created) = resolve_property(
                    pool,
                    &mut prop_map,
                    &mut existing_props,
                    get(row, &["property_id"]),
                    get(row, &["property_name", "Property Name"]),
                    get(row, &["city"]),
                    get(row, &["country"]),
                )
                .await?;
                let Some(prop_id) = prop_id else {
                    return Ok(false);
                };
                if created {
                    props_created += 1;
                }
                let code = get(row, &["reservation_id", "confirmation_code"]).to_string();
                if !code.is_empty() && existing_res_codes.contains(&code) {
                    return Ok(false);
                }
                let check_in = parse_date(get(row, &["check_in", "Check-in"]), date_fmt)
                    .map_err(AppError::Validation)?;
                let check_out = parse_date(get(row, &["check_out", "Check-out"]), date_fmt)
                    .map_err(AppError::Validation)?;
                let mut nights: i64 = get(row, &["nights", "Nights"]).trim().parse().unwrap_or(0);
                if nights == 0 {
                    nights = (check_out - check_in).num_days();
                }
                let gross: f64 = get(row, &["gross_amount", "gross_revenue", "Amount"])
                    .trim()
                    .parse()
                    .unwrap_or(0.0);
                let status = match get(row, &["status"]).trim() {
                    "Cancelled" => "cancelled",
                    "Completed" => "completed",
                    _ => "confirmed",
                };
                let now = now_iso();
                let reservation = Reservation {
                    id: Uuid::new_v4().to_string(),
                    property_id: prop_id.clone(),
                    listing_id: None,
                    external_id: None,
                    confirmation_code: if code.is_empty() {
                        None
                    } else {
                        Some(code.clone())
                    },
                    status: status.to_string(),
                    source: "csv".into(),
                    check_in: check_in.format("%Y-%m-%d").to_string(),
                    check_out: check_out.format("%Y-%m-%d").to_string(),
                    booked_at: None,
                    cancelled_at: None,
                    nights,
                    guest_name: {
                        let g = get(row, &["guest_name"]);
                        if g.trim().is_empty() {
                            None
                        } else {
                            Some(g.trim().to_string())
                        }
                    },
                    guest_email: None,
                    guest_phone: None,
                    number_of_guests: 2,
                    gross_revenue: gross,
                    cleaning_fee: 0.0,
                    platform_fee: gross * 0.15,
                    taxes: 0.0,
                    net_revenue: gross * 0.85,
                    currency: currency.to_string(),
                    property_name: {
                        let p = get(row, &["property_name"]);
                        if p.trim().is_empty() {
                            None
                        } else {
                            Some(p.trim().to_string())
                        }
                    },
                    property_city: None,
                    property_country: None,
                    notes: None,
                    deleted_at: None,
                    is_deleted: false,
                    created_at: now.clone(),
                    updated_at: now,
                    sync_id: None,
                };
                res_repo::insert(pool, &reservation).await?;
                if !code.is_empty() {
                    existing_res_codes.insert(code);
                }
                Ok(true)
            }
            .await;
            match outcome {
                Ok(true) => imported += 1,
                Ok(false) => skipped += 1,
                Err(e) => errors.push(e.to_string()),
            }
        }
    } else if detected == "revenues" {
        for row in &rows {
            let outcome: Result<bool, AppError> = async {
                let (prop_id, created) = resolve_property(
                    pool,
                    &mut prop_map,
                    &mut existing_props,
                    get(row, &["property_id"]),
                    get(row, &["property_name", "Property Name"]),
                    "",
                    "",
                )
                .await?;
                let Some(prop_id) = prop_id else {
                    return Ok(false);
                };
                if created {
                    props_created += 1;
                }
                let rev_date =
                    parse_date(get(row, &["date"]), date_fmt).map_err(AppError::Validation)?;
                let gross: f64 = get(row, &["gross_revenue", "gross_amount"])
                    .trim()
                    .parse()
                    .unwrap_or(0.0);
                let comm: f64 = get(row, &["management_commission", "commission_amount"])
                    .trim()
                    .parse()
                    .unwrap_or(0.0);
                let net: f64 = get(row, &["net_revenue", "net_amount"])
                    .trim()
                    .parse()
                    .unwrap_or(gross - comm);
                let source = match get(row, &["source"]).trim().to_lowercase().as_str() {
                    "airbnb" => "airbnb",
                    "booking" => "booking",
                    "direct" => "direct",
                    _ => "csv",
                };
                let date_str = rev_date.format("%Y-%m-%d").to_string();
                let key = format!("{prop_id}|{date_str}|{gross:.4}|{net:.4}|{source}");
                if existing_rev_keys.contains(&key) {
                    return Ok(false);
                }
                let now = now_iso();
                let revenue = Revenue {
                    id: Uuid::new_v4().to_string(),
                    property_id: prop_id.clone(),
                    reservation_id: None,
                    category_id: None,
                    date: date_str,
                    gross_amount: gross,
                    commission_amount: comm,
                    net_amount: net,
                    source: source.to_string(),
                    currency: currency.to_string(),
                    description: None,
                    notes: None,
                    deleted_at: None,
                    is_deleted: false,
                    created_at: now.clone(),
                    updated_at: now,
                    sync_id: None,
                };
                finance_repo::insert_revenue(pool, &revenue).await?;
                existing_rev_keys.insert(key);
                Ok(true)
            }
            .await;
            match outcome {
                Ok(true) => imported += 1,
                Ok(false) => skipped += 1,
                Err(e) => errors.push(e.to_string()),
            }
        }
    } else if detected == "expenses" {
        for row in &rows {
            let outcome: Result<bool, AppError> = async {
                let (prop_id, created) = resolve_property(
                    pool,
                    &mut prop_map,
                    &mut existing_props,
                    get(row, &["property_id"]),
                    get(row, &["property_name", "Property Name"]),
                    "",
                    "",
                )
                .await?;
                let Some(prop_id) = prop_id else {
                    return Ok(false);
                };
                if created {
                    props_created += 1;
                }
                let exp_date =
                    parse_date(get(row, &["date"]), date_fmt).map_err(AppError::Validation)?;
                let amount: f64 = get(row, &["amount"]).trim().parse().unwrap_or(0.0);
                let cat_name = get(row, &["category"]).trim().to_string();
                let vendor = get(row, &["vendor"]).trim().to_string();
                let date_str = exp_date.format("%Y-%m-%d").to_string();
                let key = format!("{prop_id}|{date_str}|{amount:.4}|{vendor}|{cat_name}");
                if existing_exp_keys.contains(&key) {
                    return Ok(false);
                }
                let category = if cat_name.is_empty() {
                    None
                } else {
                    resolve_expense_category(pool, &mut exp_cat_cache, &cat_name).await?
                };
                let now = now_iso();
                let expense = Expense {
                    id: Uuid::new_v4().to_string(),
                    property_id: prop_id.clone(),
                    category_id: category,
                    date: date_str,
                    amount,
                    currency: currency.to_string(),
                    vendor: if vendor.is_empty() {
                        None
                    } else {
                        Some(vendor.clone())
                    },
                    payment_method: None,
                    description: if cat_name.is_empty() {
                        None
                    } else {
                        Some(cat_name.clone())
                    },
                    notes: None,
                    is_recurring: false,
                    receipt_url: None,
                    deleted_at: None,
                    is_deleted: false,
                    created_at: now.clone(),
                    updated_at: now,
                    sync_id: None,
                };
                finance_repo::insert_expense(pool, &expense).await?;
                existing_exp_keys.insert(key);
                Ok(true)
            }
            .await;
            match outcome {
                Ok(true) => imported += 1,
                Ok(false) => skipped += 1,
                Err(e) => errors.push(e.to_string()),
            }
        }
    } else {
        errors.push(format!("Unsupported import type: {detected}"));
    }

    Ok(json!({
        "format": fmt,
        "import_type": detected,
        "imported": imported,
        "skipped": skipped,
        "properties_created": props_created,
        "errors": errors.iter().take(10).cloned().collect::<Vec<_>>(),
    }))
}

/// Import reservations from an .ics calendar export (idempotent by UID).
pub async fn import_ical(
    pool: &SqlitePool,
    file_path: &Path,
    property_id: &str,
) -> Result<Value, AppError> {
    let content = read_bytes_lossy(file_path).map_err(AppError::Validation)?;
    let events = ical::parse_ics(&content);

    if events.is_empty() {
        return Ok(json!({
            "format": "ics", "import_type": "ical", "imported": 0, "skipped": 0,
            "properties_created": 0, "errors": ["No VEVENT entries found in the calendar file."],
        }));
    }

    let prop = props_repo::get_by_id(pool, property_id).await?;
    let Some(prop) = prop else {
        return Ok(json!({
            "format": "ics", "import_type": "ical", "imported": 0, "skipped": 0,
            "properties_created": 0, "errors": ["Property not found."],
        }));
    };

    let all = settings::get_all(pool).await?;
    let currency = all["default_currency"].as_str().unwrap_or("EUR");

    let mut existing_uids: HashSet<String> = sqlx::query_scalar(
        "SELECT external_id FROM reservations WHERE external_id IS NOT NULL AND property_id = ?",
    )
    .bind(property_id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .collect();

    let mut imported: i64 = 0;
    let mut skipped: i64 = 0;
    for ev in events {
        if !ev.uid.is_empty() && existing_uids.contains(&ev.uid) {
            skipped += 1;
            continue;
        }
        let now = now_iso();
        let reservation = Reservation {
            id: Uuid::new_v4().to_string(),
            property_id: property_id.to_string(),
            listing_id: None,
            external_id: Some(ev.uid.clone()),
            confirmation_code: Some(ev.uid.clone()),
            status: "confirmed".into(),
            source: "ical".into(),
            check_in: ev.check_in.format("%Y-%m-%d").to_string(),
            check_out: ev.check_out.format("%Y-%m-%d").to_string(),
            booked_at: None,
            cancelled_at: None,
            nights: ev.nights,
            guest_name: if ev.summary.trim().is_empty() {
                None
            } else {
                Some(ev.summary.clone())
            },
            guest_email: None,
            guest_phone: None,
            number_of_guests: 1,
            gross_revenue: 0.0,
            cleaning_fee: 0.0,
            platform_fee: 0.0,
            taxes: 0.0,
            net_revenue: 0.0,
            currency: currency.to_string(),
            property_name: Some(prop.name.clone()),
            property_city: None,
            property_country: None,
            notes: None,
            deleted_at: None,
            is_deleted: false,
            created_at: now.clone(),
            updated_at: now,
            sync_id: None,
        };
        res_repo::insert(pool, &reservation).await?;
        existing_uids.insert(ev.uid);
        imported += 1;
    }

    Ok(json!({
        "format": "ics",
        "import_type": "ical",
        "imported": imported,
        "skipped": skipped,
        "properties_created": 0,
        "errors": [],
    }))
}
