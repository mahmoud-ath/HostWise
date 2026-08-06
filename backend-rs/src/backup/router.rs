//! Backup HTTP routes, mirroring `backend/app/backup_router.py`.
//!
//! GET    /api/v1/backups                 -> list
//! GET    /api/v1/backups/status          -> schedule/storage overview
//! POST   /api/v1/backups/create          -> on-demand backup
//! POST   /api/v1/backups/upload          -> upload a .db backup (multipart)
//! GET    /api/v1/backups/download/{name} -> download a backup file
//! POST   /api/v1/backups/{name}/verify   -> integrity check
//! POST   /api/v1/backups/restore/{name}  -> restore
//! DELETE /api/v1/backups/{name}          -> delete

use axum::extract::{Multipart, Path, State};
use axum::http::StatusCode;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::auth::extractors::AuthUser;
use crate::backup;
use crate::core::error::AppError;
use crate::core::state::AppState;

pub fn build_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_backups))
        .route("/status", get(status))
        .route("/create", post(create))
        .route("/upload", post(upload))
        .route("/download/{name}", get(download))
        .route("/{name}/verify", post(verify))
        .route("/restore/{name}", post(restore))
        .route("/{name}", delete(delete_backup))
}

/// Keep only a bare `.db` filename (no path separators) to avoid traversal.
fn sanitize_backup_name(name: &str) -> Result<String, AppError> {
    let base = std::path::Path::new(name)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    if base.is_empty() || base != name || !base.ends_with(".db") {
        return Err(AppError::NotFound);
    }
    Ok(base)
}

async fn list_backups(
    State(_state): State<AppState>,
    _auth: AuthUser,
) -> Json<Vec<backup::BackupInfo>> {
    Json(backup::list_backups())
}

async fn status(State(_state): State<AppState>, _auth: AuthUser) -> Json<Value> {
    let backups = backup::list_backups();
    let last_backup = backups.first().map(|b| {
        json!({ "name": b.name, "created": b.created })
    });
    let next_backup = match &last_backup {
        Some(l) => {
            let created = chrono::DateTime::parse_from_rfc3339(&l["created"].as_str().unwrap_or(""))
                .map(|dt| dt.with_timezone(&chrono::Local) + chrono::Duration::days(1))
                .unwrap_or_else(|_| chrono::Local::now() + chrono::Duration::days(1));
            created.to_rfc3339()
        }
        None => (chrono::Local::now() + chrono::Duration::days(1)).to_rfc3339(),
    };
    Json(json!({
        "schedule": "daily",
        "last_backup": last_backup,
        "next_backup": next_backup,
        "backup_count": backups.len(),
        "total_size": backups.iter().map(|b| b.size).sum::<u64>(),
        "retention": { "daily": 7, "weekly": 4, "monthly": 3 },
    }))
}

async fn create(State(state): State<AppState>, _auth: AuthUser) -> Result<Json<Value>, AppError> {
    match backup::create_backup(&state.config.sqlite_path, "manual").await {
        Some(p) => Ok(Json(json!({ "message": "Backup created", "path": p.to_string_lossy() }))),
        None => Err(AppError::Internal(anyhow::anyhow!("Failed to create backup"))),
    }
}

async fn upload(
    State(_state): State<AppState>,
    _auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<Value>, AppError> {
    let mut content: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation(e.to_string()))?
    {
        if field.name() == Some("file") {
            filename = field.file_name().map(|s| s.to_string());
            content = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| AppError::Validation(e.to_string()))?
                    .to_vec(),
            );
        }
    }

    let content = content.ok_or_else(|| AppError::Validation("No file uploaded".into()))?;
    let fname = filename.unwrap_or_default();
    if !fname.ends_with(".db") {
        return Err(AppError::Validation("Please upload a .db backup file".into()));
    }

    let name = format!(
        "hostwise_uploaded_{}.db",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let dir = backup::backups_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;
    std::fs::write(dir.join(&name), content)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;

    Ok(Json(json!({ "message": "Backup uploaded", "name": name })))
}

async fn download(
    State(_state): State<AppState>,
    _auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Response, AppError> {
    let safe = sanitize_backup_name(&name)?;
    let path = backup::backups_dir().join(&safe);
    if !path.exists() {
        return Err(AppError::NotFound);
    }
    let bytes = std::fs::read(&path)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;

    let mut response = (StatusCode::OK, bytes).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, "application/octet-stream".parse().unwrap());
    response.headers_mut().insert(
        CONTENT_DISPOSITION,
        format!("attachment; filename=\"{safe}\"")
            .parse()
            .map_err(|_| AppError::Internal(anyhow::anyhow!("bad header")))?,
    );
    Ok(response)
}

async fn verify(
    State(_state): State<AppState>,
    _auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Json<Value>, AppError> {
    let safe = sanitize_backup_name(&name)?;
    let result = backup::verify_backup_by_name(&safe).await;
    if result["error"] == "Backup not found" {
        return Err(AppError::NotFound);
    }
    Ok(Json(result))
}

async fn restore(
    State(state): State<AppState>,
    _auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Json<Value>, AppError> {
    let safe = sanitize_backup_name(&name)?;
    let ok = backup::restore_backup(&state.config.sqlite_path, &safe).await;
    if !ok {
        return Err(AppError::Validation(format!("Failed to restore backup {safe}")));
    }
    Ok(Json(json!({ "message": format!("Database restored from {safe}") })))
}

async fn delete_backup(
    State(_state): State<AppState>,
    _auth: AuthUser,
    Path(name): Path<String>,
) -> Result<Json<Value>, AppError> {
    let safe = sanitize_backup_name(&name)?;
    let path = backup::backups_dir().join(&safe);
    if !path.exists() {
        return Err(AppError::NotFound);
    }
    std::fs::remove_file(&path)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;
    Ok(Json(json!({ "message": "Backup deleted" })))
}
