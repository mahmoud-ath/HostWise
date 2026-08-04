/**
 * Report export helpers — dependency-free.
 *
 * - CSV: proper RFC-4180 escaping, opens in Excel/Sheets.
 * - Excel: HTML-table based .xls (opens natively in Excel).
 * - PDF / Print: triggers the browser print dialog with print-optimized CSS.
 * - Share: native share sheet with clipboard fallback.
 */

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  downloadFile(filename, lines.join("\n"), "text/csv;charset=utf-8;");
}

export interface ExcelSection {
  title: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

/** Generates a real Excel-readable .xls file from HTML tables (no deps). */
export function exportToExcel(filename: string, sections: ExcelSection[]) {
  const html = [
    "<html xmlns:x=\"urn:schemas-microsoft-com:office:excel\">",
    "<head><meta charset=\"utf-8\">",
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>",
    `<x:Name>${filename.replace(/\.xls$/i, "")}</x:Name>`,
    "<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>",
    "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->",
    "<style>td,th{border:1px solid #ccc;padding:4px 8px;mso-number-format:'\\@';}",
    "th{background:#f5f5f5;font-weight:bold;}</style></head><body>",
  ];

  for (const section of sections) {
    html.push(`<h3>${section.title}</h3><table>`);
    html.push(
      `<tr>${section.headers.map((h) => `<th>${csvEscape(h)}</th>`).join("")}</tr>`
    );
    for (const row of section.rows) {
      html.push(
        `<tr>${row.map((cell) => `<td>${csvEscape(cell)}</td>`).join("")}</tr>`
      );
    }
    html.push("</table><br/>");
  }
  html.push("</body></html>");

  downloadFile(filename, html.join(""), "application/vnd.ms-excel;charset=utf-8;");
}

/** Opens the browser print dialog → "Save as PDF". */
export function exportToPDF() {
  window.print();
}

/** Native share sheet (desktop fallback: copy summary to clipboard). */
export async function shareReport(title: string, text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "unsupported";
  }
}

export function formatDateForFile(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
