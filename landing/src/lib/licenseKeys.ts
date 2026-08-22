/**
 * License / application keys that unlock the download gate.
 *
 * Add every key you hand out to a customer here — one string per entry.
 * Keys are matched case-insensitively and ignoring extra spaces, so
 * `hostwise-ab12-...` and ` HOSTWISE-AB12-... ` both work.
 *
 * NOTE: this file ships inside the site's JavaScript bundle, so anyone with a
 * browser devtools can read the list. Treat it as a soft gate (and a way to
 * log who tried to download), not as DRM. A suggested key shape:
 * `HOSTWISE-XXXX-XXXX-XXXX`.
 */
export const VALID_LICENSE_KEYS: string[] = [
   "HOSTWISE-1MA1-QNXR-20ET",
  // "HOSTWISE-DDDD-EEEE-FFFF",
];

/** Trim + uppercase + collapse stray spaces so comparisons are forgiving. */
export function normalizeLicenseKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, " ").trim();
}

/** True when the key is in the approved list (ignoring case/spacing). */
export function validateLicenseKey(key: string): boolean {
  const normalized = normalizeLicenseKey(key);
  if (!normalized) return false;
  return VALID_LICENSE_KEYS.some(
    (valid) => normalizeLicenseKey(valid) === normalized
  );
}
