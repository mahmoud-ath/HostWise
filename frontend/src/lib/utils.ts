import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Active locale used for date / number / month formatting.
 * Set from the app's Language setting (see settings-context).
 */
let activeLocale = "en-US";

/** Map HostWise's Language setting value to a BCP-47 locale tag. */
export function languageToLocale(language?: string | null): string {
  switch ((language || "English").trim()) {
    case "Français":
      return "fr-FR";
    case "Español":
      return "es-ES";
    case "العربية":
      return "ar-MA";
    case "Deutsch":
      return "de-DE";
    default:
      return "en-US";
  }
}

/** Whether the active language is right-to-left (e.g. Arabic). */
export function isRtlLanguage(language?: string | null): boolean {
  return (language || "English").trim() === "العربية";
}

/** Update the app-wide formatting locale (called by the settings context). */
export function setAppLocale(locale: string) {
  activeLocale = locale;
}

export function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat(activeLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyDetailed(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat(activeLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(activeLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatMonth(month: number): string {
  return new Intl.DateTimeFormat(activeLocale, { month: "long" }).format(
    new Date(2024, month - 1)
  );
}

export function getMonthName(month: number): string {
  return formatMonth(month);
}
