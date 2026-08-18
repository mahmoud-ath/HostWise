//! Connectors HTTP routes, mirroring `backend/app/connectors/router.py`.
//!
//! GET  /api/v1/connectors/guide
//! GET  /api/v1/connectors/available
//! POST /api/v1/connectors/csv/upload
//! POST /api/v1/connectors/csv/import?filename=&import_type=
//! POST /api/v1/connectors/ical/upload
//! POST /api/v1/connectors/ical/import?filename=&property_id=

use std::path::Path;

use axum::extract::{Multipart, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::connectors::ical;
use crate::connectors::service;
use crate::core::error::AppError;
use crate::core::state::AppState;

#[derive(Debug, Deserialize)]
struct CsvImportQuery {
    filename: String,
    #[serde(default = "default_import_type")]
    import_type: String,
}

fn default_import_type() -> String {
    "auto".into()
}

#[derive(Debug, Deserialize)]
struct IcalImportQuery {
    filename: String,
    property_id: Uuid,
}

fn sanitize_filename(name: &str) -> String {
    Path::new(name)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "upload.bin".into())
}

async fn take_upload(multipart: &mut Multipart) -> Result<(String, Vec<u8>), AppError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation(e.to_string()))?
    {
        if field.name() == Some("file") {
            let fname = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.bin".into());
            let bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::Validation(e.to_string()))?
                .to_vec();
            return Ok((fname, bytes));
        }
    }
    Err(AppError::Validation("No file uploaded".into()))
}

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/guide", get(guide))
        .route("/available", get(available))
        .route("/csv/upload", post(upload_csv))
        .route("/csv/import", post(import_csv))
        .route("/ical/upload", post(upload_ical))
        .route("/ical/import", post(import_ical))
}

async fn guide() -> Json<Value> {
    Json(json!({
        "reservations": {
            "required": ["property_name", "check_in", "check_out"],
            "optional": ["property_id", "guest_name", "nights", "gross_amount", "status"],
            "notes": "check_in / check_out use the configured date format (default DD/MM/YYYY). Missing properties are created automatically.",
        },
        "revenues": {
            "required": ["property_name", "date", "gross_revenue"],
            "optional": ["property_id", "commission_amount", "net_revenue", "source"],
            "notes": "source can be airbnb, booking, direct or csv. net_revenue defaults to gross minus commission.",
        },
        "expenses": {
            "required": ["property_name", "date", "amount"],
            "optional": ["property_id", "category", "vendor"],
            "notes": "category is stored as the expense description.",
        },
        "ical": {
            "required": ["property_id (in the import request)", ".ics calendar file"],
            "optional": [],
            "notes": "Airbnb / Booking calendar export (.ics). Each VEVENT becomes a reservation: guest name from SUMMARY, check-in/check-out from DTSTART/DTEND. Imported with source 'ical' and zero amounts (link revenue separately via CSV). Re-imports are safe — already-known UIDs are skipped.",
        },
    }))
}

async fn available() -> Json<Value> {
    Json(json!({
        "connectors": [
            { "id": "csv", "name": "CSV / JSON import", "kind": "file", "status": "available" },
            { "id": "ical", "name": "iCal calendar", "kind": "file", "status": "available" }
        ]
    }))
}

async fn upload_csv(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<Value>, AppError> {
    let (fname, content) = take_upload(&mut multipart).await?;
    let dir = state.config.upload_dir.clone();
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;
    let safe = sanitize_filename(&fname);
    let path = dir.join(&safe);
    std::fs::write(&path, content)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;

    // Preview with the same encoding + delimiter the import will use, so the
    // user doesn't see mojibake for non-UTF-8 files.
    let all = crate::settings::service::get_all(&state.pool).await?;
    let enc = all["import_encoding"].as_str().unwrap_or("UTF-8");
    let delim = all["import_delimiter"].as_str().unwrap_or(",");

    match service::read_file(&path, Some(enc), Some(delim)) {
        Ok((fmt, columns, rows)) => {
            let preview: Vec<Value> = rows
                .iter()
                .take(5)
                .map(|r| serde_json::to_value(r).unwrap_or(Value::Null))
                .collect();
            Ok(Json(json!({
                "filename": safe,
                "file_path": path.to_string_lossy(),
                "format": fmt,
                "columns": columns,
                "preview_rows": preview,
                "row_count_estimate": rows.len(),
            })))
        }
        Err(e) => Err(AppError::Validation(e)),
    }
}

async fn import_csv(
    State(state): State<AppState>,
    Query(q): Query<CsvImportQuery>,
) -> Result<Json<Value>, AppError> {
    let path = state.config.upload_dir.join(sanitize_filename(&q.filename));
    if !path.exists() {
        return Ok(Json(json!({
            "error": format!("File '{}' not found. Upload it first.", q.filename),
            "imported": 0,
        })));
    }
    let result = service::import_file(&state.pool, &path, &q.import_type).await?;
    let _ = std::fs::remove_file(&path);
    Ok(Json(result))
}

async fn upload_ical(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<Value>, AppError> {
    let (fname, content) = take_upload(&mut multipart).await?;
    let dir = state.config.upload_dir.clone();
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;
    let safe = sanitize_filename(&fname);
    let path = dir.join(&safe);
    std::fs::write(&path, &content)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;

    let text = String::from_utf8_lossy(&content).to_string();
    let events = ical::parse_ics(&text);
    let preview: Vec<Value> = events
        .iter()
        .take(5)
        .map(|e| {
            json!({
                "uid": e.uid,
                "summary": e.summary,
                "check_in": e.check_in.format("%Y-%m-%d").to_string(),
                "check_out": e.check_out.format("%Y-%m-%d").to_string(),
                "nights": e.nights,
            })
        })
        .collect();
    Ok(Json(json!({
        "filename": safe,
        "file_path": path.to_string_lossy(),
        "format": "ics",
        "events": events.len(),
        "preview_rows": preview,
    })))
}

async fn import_ical(
    State(state): State<AppState>,
    Query(q): Query<IcalImportQuery>,
) -> Result<Json<Value>, AppError> {
    let path = state.config.upload_dir.join(sanitize_filename(&q.filename));
    if !path.exists() {
        return Ok(Json(json!({
            "error": format!("File '{}' not found. Upload it first.", q.filename),
            "imported": 0,
        })));
    }
    let result = service::import_ical(&state.pool, &path, &q.property_id.to_string()).await?;
    let _ = std::fs::remove_file(&path);
    Ok(Json(result))
}
