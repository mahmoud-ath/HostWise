//! Small time helpers (timezone-aware UTC, RFC 3339 strings).

use chrono::Utc;

/// Current UTC time as an RFC 3339 string (matches SQLAlchemy ISO datetimes).
pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
