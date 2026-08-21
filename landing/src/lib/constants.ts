 /** Full-screen hero background video (local MP4 in public/video). */
export const HERO_VIDEO_URL = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260715_090628_7052d8a6-a094-4341-a4a2-ad58493a67a9.mp4";

/** HostWise tagline used in the footer. */
export const TAGLINE = "Own your data. Know your numbers.";

/** Version used to build the local download filenames in public/downloads/. */
export const DOWNLOAD_VERSION = "0.8.2";

/**
 * The site's origin, used to build copy-paste URLs (like the curl one-liner)
 * that always match wherever the site is actually deployed. Falls back to the
 * brand domain during build/SSR.
 */
export const SITE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://hostwise.app";

/**
 * Google Apps Script Web App URL that appends leads to a Google Sheet.
 * Paste your deployed "/exec" URL here (see landing/LEAD-CAPTURE-SETUP.md).
 * While empty, the email gate still works but simply skips the network call.
 */
export const LEAD_SHEET_URL = "https://script.google.com/macros/s/AKfycbw7hkULK8feSm_XLXHjNpGcsc_u6Y-XiGOMvwsW_9lSDzZEaTEZdo9M5QkCxjIhprxi/exec";
