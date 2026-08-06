//! iCal (.ics) parser — Airbnb/Booking calendar export.
//! Dependency-free, tolerant: only needs UID/SUMMARY/DTSTART/DTEND, handles
//! folded lines, VALUE=DATE and date-time values. Mirrors
//! `backend/app/connectors/ical.py`.

use std::collections::HashMap;

use chrono::NaiveDate;

#[derive(Debug, Clone)]
pub struct IcalEvent {
    pub uid: String,
    pub summary: String,
    pub check_in: NaiveDate,
    pub check_out: NaiveDate,
    pub nights: i64,
}

/// Join RFC-5545 folded lines (a line starting with space/tab continues the
/// previous one).
fn unfold_lines(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut buf = String::new();
    for raw in text.lines() {
        let line = raw.trim_end_matches('\r');
        if line.starts_with(' ') || line.starts_with('\t') {
            buf.push_str(&line[1..]);
        } else {
            if !buf.is_empty() {
                out.push(std::mem::take(&mut buf));
            }
            buf = line.to_string();
        }
    }
    if !buf.is_empty() {
        out.push(buf);
    }
    out
}

/// Parse an iCal date or date-time value, ignoring TZID/UTC markers.
/// Supports `20250401` (VALUE=DATE) and `20250401T140000[Z]`.
fn parse_ical_date(value: &str) -> Option<NaiveDate> {
    let v = value.trim();
    let v = v.strip_suffix('Z').unwrap_or(v);
    if v.len() == 8 && v.chars().all(|c| c.is_ascii_digit()) {
        let y: i32 = v[0..4].parse().ok()?;
        let m: u32 = v[4..6].parse().ok()?;
        let d: u32 = v[6..8].parse().ok()?;
        return NaiveDate::from_ymd_opt(y, m, d);
    }
    if v.len() >= 15 && v.as_bytes().get(8) == Some(&b'T') {
        let y: i32 = v[0..4].parse().ok()?;
        let m: u32 = v[4..6].parse().ok()?;
        let d: u32 = v[6..8].parse().ok()?;
        return NaiveDate::from_ymd_opt(y, m, d);
    }
    None
}

/// Unescape RFC-5545 TEXT values.
fn unescape(text: &str) -> String {
    text.replace("\\n", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
}

/// Parse .ics text into reservation events.
pub fn parse_ics(content: &str) -> Vec<IcalEvent> {
    let mut events: Vec<HashMap<String, String>> = Vec::new();
    let mut current: Option<HashMap<String, String>> = None;

    for line in unfold_lines(content) {
        if line == "BEGIN:VEVENT" {
            current = Some(HashMap::new());
        } else if line == "END:VEVENT" {
            if let Some(ev) = current.take() {
                events.push(ev);
            }
        } else if let Some(cur) = current.as_mut() {
            if let Some(idx) = line.find(':') {
                let (key, rest) = line.split_at(idx);
                let value = &rest[1..];
                let name = key.split(';').next().unwrap_or("").to_uppercase();
                if matches!(name.as_str(), "UID" | "SUMMARY" | "DTSTART" | "DTEND") {
                    cur.insert(name, value.to_string());
                }
            }
        }
    }

    let mut reservations = Vec::new();
    for ev in events {
        let uid = ev
            .get("UID")
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        let summary = unescape(ev.get("SUMMARY").map(|s| s.trim()).unwrap_or(""));
        let Some(check_in) = ev.get("DTSTART").and_then(|s| parse_ical_date(s)) else {
            continue;
        };
        let mut check_out = ev.get("DTEND").and_then(|s| parse_ical_date(s));
        if let Some(co) = check_out {
            if co <= check_in {
                check_out = Some(check_in + chrono::Duration::days(1));
            }
        }
        let check_out = check_out.unwrap_or_else(|| check_in + chrono::Duration::days(1));
        reservations.push(IcalEvent {
            uid,
            summary,
            check_in,
            check_out,
            nights: (check_out - check_in).num_days(),
        });
    }
    reservations
}
