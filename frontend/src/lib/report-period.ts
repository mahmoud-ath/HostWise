/**
 * Report period helpers.
 *
 * The report engine is period-driven: a calendar year is one preset, and a
 * custom date range is first-class. `ReportPeriod` is what the API expects —
 * either a full `year`, or a `start`/`end` ISO date pair (mutually exclusive).
 */

export interface ReportPeriod {
  /** Full calendar year — mutually exclusive with start/end. */
  year?: number;
  /** Custom range start (ISO yyyy-mm-dd). */
  start?: string;
  /** Custom range end (ISO yyyy-mm-dd). */
  end?: string;
}

export function isCustomPeriod(p: ReportPeriod): boolean {
  return !!p.start && !!p.end;
}

/** Stable string key for React Query caches / notes. */
export function periodKey(p: ReportPeriod): string {
  if (p.year) return String(p.year);
  if (p.start && p.end) return `${p.start}|${p.end}`;
  return "none";
}

/** ISO date for an HTML `<input type="date">`. */
export function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Short label for a period (used in titles/buttons). */
export function periodLabel(p: ReportPeriod): string {
  if (p.year) return String(p.year);
  if (p.start && p.end) return `${p.start} – ${p.end}`;
  return "";
}

/**
 * The equally-sized period immediately before `p`.
 * A calendar year compares to the previous year; a custom range compares to
 * the same-length window immediately before it (matching the backend).
 */
export function previousPeriod(p: ReportPeriod): ReportPeriod {
  if (p.year) return { year: p.year - 1 };
  if (p.start && p.end) {
    const start = new Date(`${p.start}T00:00:00`);
    const end = new Date(`${p.end}T00:00:00`);
    const len = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 86_400_000); // day before start
    const prevStart = new Date(prevEnd.getTime() - len);
    return { start: toInputDate(prevStart), end: toInputDate(prevEnd) };
  }
  return {};
}
