"""
iCal (.ics) Connector — Parser

Airbnb and Booking don't expose an official public reservations API for
hosts, but they both offer calendar export (.ics) links. HostWise imports
those calendars and turns each VEVENT into a reservation:

- guest name comes from SUMMARY
- check-in / check-out come from DTSTART / DTEND
- DTEND is exclusive in the iCal spec, so nights = (DTEND - DTSTART).days

This is intentionally a dependency-free, tolerant parser: it only needs the
four fields above, handles folded lines, `VALUE=DATE` and date-time values,
and ignores everything else in the file.
"""
import re
from datetime import date, timedelta

__all__ = ["parse_ics"]


def _unfold_lines(text: str) -> list[str]:
    """Join RFC-5545 folded lines (a line starting with space/tab continues the previous one)."""
    unfolded: list[str] = []
    buf = ""
    for raw in text.splitlines():
        line = raw.rstrip("\r")
        if line.startswith((" ", "\t")):
            buf += line[1:]
        else:
            if buf:
                unfolded.append(buf)
            buf = line
    if buf:
        unfolded.append(buf)
    return unfolded


def _parse_ical_date(value: str) -> date | None:
    """Parse an iCal date or date-time value, ignoring TZID/UTC markers.

    Supports both `20250401` (VALUE=DATE) and `20250401T140000` / with `Z`.
    """
    value = (value or "").strip().removesuffix("Z")
    if len(value) == 8 and value.isdigit():
        return date(int(value[0:4]), int(value[4:6]), int(value[6:8]))
    match = re.fullmatch(r"(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})", value)
    if match:
        y, m, d = (int(match.group(i)) for i in (1, 2, 3))
        return date(y, m, d)
    return None


def _unescape(text: str) -> str:
    """Unescape RFC-5545 TEXT values (commas, semicolons, newlines, backslashes)."""
    return (
        text.replace("\\n", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
    )


def parse_ics(content: str) -> list[dict]:
    """Parse .ics text into a list of reservation dicts.

    Returns a list of::

        {"uid": str, "summary": str, "check_in": date, "check_out": date, "nights": int}
    """
    events: list[dict] = []
    current: dict | None = None

    for line in _unfold_lines(content):
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT":
            if current is not None:
                events.append(current)
                current = None
        elif current is not None and ":" in line:
            key, _, value = line.partition(":")
            name = key.split(";")[0].upper()
            if name in ("UID", "SUMMARY", "DTSTART", "DTEND"):
                current[name] = value

    reservations: list[dict] = []
    for ev in events:
        uid = (ev.get("UID") or "").strip()
        summary = _unescape((ev.get("SUMMARY") or "").strip())
        check_in = _parse_ical_date(ev.get("DTSTART") or "")
        if check_in is None:
            continue
        check_out = _parse_ical_date(ev.get("DTEND") or "")
        if check_out is None or check_out <= check_in:
            check_out = check_in + timedelta(days=1)
        reservations.append({
            "uid": uid,
            "summary": summary,
            "check_in": check_in,
            "check_out": check_out,
            "nights": (check_out - check_in).days,
        })
    return reservations
