//! Application configuration, mirroring `backend/app/core/config.py`.
//!
//! All settings are read from environment variables (`.env` file supported via
//! `dotenvy`). Never hardcode secrets.

use std::env;
use std::path::PathBuf;

/// Platform-appropriate app data directory (`launcher.py` `_get_data_dir`).
pub fn default_data_dir() -> PathBuf {
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    let base = if cfg!(target_os = "windows") {
        env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home)
    } else if cfg!(target_os = "macos") {
        home.join("Library").join("Application Support")
    } else {
        env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".local").join("share"))
    };
    base.join("hostwise")
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_opt(key: &str) -> Option<String> {
    match env::var(key) {
        Ok(v) if !v.trim().is_empty() => Some(v),
        _ => None,
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub app_name: String,
    pub app_version: String,
    pub environment: String,
    pub host: String,
    pub port: u16,
    pub database_type: String,
    pub sqlite_path: PathBuf,
    pub jwt_secret_key: String,
    pub jwt_access_token_expire_minutes: i64,
    pub jwt_refresh_token_expire_days: i64,
    pub cors_origins: Vec<String>,
    pub upload_dir: PathBuf,
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let data_dir = default_data_dir();
        let sqlite_path = env::var("SQLITE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| data_dir.join("hostwise.db"));

        let cors_origins = env_or(
            "CORS_ORIGINS",
            r#"["http://localhost:3000","tauri://localhost"]"#,
        );
        let cors_origins: Vec<String> =
            serde_json::from_str(&cors_origins).unwrap_or_else(|_| {
                vec![
                    "http://localhost:3000".to_string(),
                    "tauri://localhost".to_string(),
                ]
            });

        Self {
            app_name: env_or("APP_NAME", "HostWise"),
            app_version: env_or("APP_VERSION", "0.7.0"),
            environment: env_or("ENVIRONMENT", "development"),
            host: env_or("HOST", "127.0.0.1"),
            port: env_or("PORT", "8000").parse().unwrap_or(8000),
            database_type: env_or("DATABASE_TYPE", "sqlite"),
            sqlite_path,
            jwt_secret_key: env_or(
                "JWT_SECRET_KEY",
                "change-me-in-production-use-openssl-rand-hex-64",
            ),
            jwt_access_token_expire_minutes: env_or("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
                .parse()
                .unwrap_or(60),
            jwt_refresh_token_expire_days: env_or("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "30")
                .parse()
                .unwrap_or(30),
            cors_origins,
            upload_dir: env_or("UPLOAD_DIR", "uploads").into(),
            openai_api_key: env_opt("OPENAI_API_KEY"),
            anthropic_api_key: env_opt("ANTHROPIC_API_KEY"),
        }
    }

    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }
}
