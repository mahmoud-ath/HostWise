# Email lead capture → Google Sheets (setup)

The landing page collects an **email + license key** before every
Download/Install click. Both are posted to a **Google Apps Script Web App**,
which appends them to a Google Sheet. No server of your own is needed.

Keys are validated client-side against the list in
`landing/src/lib/licenseKeys.ts` (add every key you hand out there). Every
attempt is logged to the sheet — including invalid keys — and the download
only starts when the key is valid.

The client code is already wired in `landing/src/lib/leadGate.tsx`. The only
step left for you is to create the script, deploy it, and paste its URL into
`landing/src/lib/constants.ts`.

---

## 1. Create the spreadsheet

1. Open <https://sheets.new> and name it **HostWise Leads**.
2. Rename the first tab to `Leads` (exact name — the script uses it).
3. Add these column headers in row 1:

   | A          | B     | C   | D      | E    | F         | G     | H       |
   | ---------- | ----- | --- | ------ | ---- | --------- | ----- | ------- |
   | `Timestamp`|`Email`| `OS`|`Source`|`Page`| `Referrer`| `Key` | `Valid` |

   (`Key` = the license key the visitor typed, `Valid` = `TRUE`/`FALSE`
   whether it matched the approved list. Both are also sent when `Key` is
   empty — e.g. footer subscribe submits use `Key = ""`.)

## 2. Create the Apps Script

1. In the sheet, go to **Extensions → Apps Script**.
2. Delete the default `myFunction` and paste:

```javascript
/**
 * Health check + diagnostics for the Web App deployment. A GET (including
 * Google's deployment verification) returns this. It reports which
 * spreadsheet the script is bound to and whether leads are landing — paste the
 * output back to the dev if leads seem to be going missing.
 */
function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss ? ss.getSheetByName("Leads") : null;
    const lastRow = sheet ? sheet.getLastRow() : 0;
    const lastValues =
      sheet && lastRow > 1
        ? sheet
            .getRange(lastRow, 1, 1, Math.min(6, sheet.getLastColumn()))
            .getValues()[0]
        : [];
    return ContentService.createTextOutput(
      JSON.stringify({
        ok: true,
        service: "HostWise lead capture",
        spreadsheetName: ss ? ss.getName() : "(script not bound to any spreadsheet)",
        spreadsheetUrl: ss ? ss.getUrl() : null,
        leadsTabExists: !!sheet,
        leadsLastRow: lastRow,
        leadsLastValues: lastValues,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Receives POSTs from the HostWise landing page and appends each lead to the
 * "Leads" tab of the spreadsheet this script is BOUND to (the one you opened
 * "Extensions → Apps Script" from — NOT necessarily the one you're viewing).
 * Rows are added at the BOTTOM of the tab.
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Leads");
    if (!sheet) {
      // Never fail silently: create the tab with headers if it's missing.
      sheet = ss.insertSheet("Leads");
      sheet.appendRow(["Timestamp", "Email", "OS", "Source", "Page", "Referrer", "Key", "Valid"]);
    }
    const data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      new Date(),                    // Timestamp
      (data.email || "").trim(),     // Email
      data.os || "",                 // OS
      data.source || "",             // Source (card / navbar / docs / footer)
      data.page || "",               // Page
      data.referrer || "",           // Referrer
      data.key || "",                // License key typed ("" for footer subscribe)
      data.keyValid === undefined ? "" : (data.keyValid ? "TRUE" : "FALSE"), // Valid?
    ]);
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, row: sheet.getLastRow(), spreadsheetUrl: ss.getUrl() })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Save (Ctrl/Cmd + S), give it a name like `HostWise Lead Capture`.

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Type: **Web app**.
3. Settings:
   - **Execute as**: *Me* (hostwise.app account)
   - **Who has access**: *Anyone*
   - **Description**: `HostWise landing lead capture`
4. Click **Deploy** and confirm the permissions on the Google prompt.
5. Copy the **Web app URL** — it ends in `/exec`, e.g.
   `https://script.google.com/macros/s/XXXXXXXX/exec`.

> ⚠️ If you redeploy later with "New version", keep the same `/exec` URL — no
> code change needed on the site.
>
> **Already deployed?** After editing the script you must push a new version or
> the deployed code won't change: **Deploy → Manage deployments → Edit
> (pencil) → Version: *New version* → Deploy**. The `/exec` URL stays the same,
> so nothing changes on the site.

## 4. Paste the URL into the site

Open `landing/src/lib/constants.ts` and set:

```ts
export const LEAD_SHEET_URL =
  "https://script.google.com/macros/s/PASTE_YOUR_URL_HERE/exec";
```

While `LEAD_SHEET_URL` is `""` (empty), the email gate still works for testing
but simply skips the network call — no data is lost, downloads still start.

## 5. What gets captured per lead

| Field | Source |
| --- | --- |
| `email` | The address the visitor typed |
| `os` | The platform card clicked, or the visitor's detected OS |
| `source` | Which button opened the gate: `navbar`, `docs`, `footer`, or the card label (e.g. `Debian / Ubuntu`) |
| `page` | The landing page they were on (`/`, `#/docs`, `#/feedback`) |
| `timestamp` | When they submitted |
| `key` | The license key they typed (empty `""` for the footer subscribe form) |
| `keyValid` | Whether the key matched `VALID_LICENSE_KEYS` (`TRUE`/`FALSE`) — invalid keys are logged too, but the download is blocked |

### License gate behavior

- The download gate now requires **both** an email and a license key.
- Keys are checked against the list in `landing/src/lib/licenseKeys.ts`
  (case-insensitive, extra spaces ignored). Add every key you hand out there.
- Every submission is logged to the sheet (valid **and** invalid keys) so you
  can see who tried and with what key.
- An invalid key shows an error and **blocks the download**; the visitor can
  retry or email `markuspub4@gmail.com`.
- The footer subscribe form is unaffected — it still saves email-only rows.

## 6. Test

1. Start the dev server: `(cd landing && bun run dev)`.
2. Click any download card, enter your email, submit.
3. Back in the sheet, a new row should appear.
4. If nothing arrives, check the Apps Script **Executions** log
   (left sidebar → Executions) for errors, and confirm the deployment access
   is *Anyone*.

**Reading the Executions log:**

| Log entry | Meaning |
| --- | --- |
| `doPost success` | ✅ The email landed in the sheet. This is the one that matters. |
| `doGet echec` | ⚠️ Deployment health-check GET had no handler. Harmless, but fixed by the `doGet` above. After redeploying a new version it disappears. |
| `doPost echec` | ❌ Real problem — open the log entry for the error. Common causes: `Leads` tab name mismatch, missing headers, or deployment access not set to *Anyone*. |

> Privacy note shown on the modal: *"No spam, ever. Your email is only used to
> send you the download link and product updates."* Keep that promise.

## 7. Troubleshooting: "all green, but no email in the sheet"

The site always shows the success state even if the write failed — the browser
uses `mode: "no-cors"` and never reads the server's reply, so **green UI ≠ row
saved**. Check these in order:

1. **Which spreadsheet owns the script?** Rows go to the spreadsheet you opened
   "Extensions → Apps Script" from, written to its **`Leads` tab** (created
   automatically by the updated script if missing). If you're viewing a
   different spreadsheet, you'll never see the rows. Compare with the
   `spreadsheetUrl` field in the `doGet` output below.
2. **Look at the last row.** `appendRow` adds at the **bottom** of the tab —
   the new lead is the bottom-most row, not at the top.
3. **Check the Executions log** (left sidebar → Executions):
   - `doPost success` with the row you just submitted → it IS saved; you're
     looking at the wrong sheet/tab.
   - `doPost echec` → open the entry for the real error.
4. **Self-diagnose with `doGet`.** The updated `doGet` above reports the exact
   spreadsheet URL, whether the `Leads` tab exists, the last row number, and
   its values. After redeploying, open
   `<your /exec URL>?diag=1` in a browser (or paste the URL to the dev) and
   read the JSON — it tells us exactly where leads are going.
