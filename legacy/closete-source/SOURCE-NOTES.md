# CLOSETÉ source notes (handoff, not an implementation)

Target GitHub repo (already created, private, empty): https://github.com/joejoe66-bot/closete-pwa

Live web app (do not modify):  
https://script.google.com/macros/s/AKfycbxe3EpgaLdJ8DKZNHLNNRc9mS5sHjHH05Mus1QoRN6leSIiFCLBkzIxGVSwB9ibCUzKAQ/exec

This is **CLOSETÉ — My Digital Wardrobe**. Do **not** mix with the older「衣櫃收納」workspace project or its spreadsheet.

## Files in this archive

- `Index.html` — clean frontend extracted from the live `/exec` page, with the pasted LLM preamble and markdown fences removed. Use this as the UI starting point.
- `deployed-userHtml-raw.txt` — the exact `userHtml` Google currently serves (still includes the Chinese “可貼到 Apps Script…” preamble and ` ```html ` fences). Reference only.
- `deployed-exec-page.html` — the outer HtmlService wrapper page as fetched (Google-controlled shell + sandbox iframe).
- `Code.gs` — exact backend source pasted by the owner (t37u). Not recovered from the editor URL (that link previously 404’d).

## Backend / data

- Bound to **the active spreadsheet** via `SpreadsheetApp.getActiveSpreadsheet()`. There is **no spreadsheet ID** in `Code.gs`.
- Tab name: `Wardrobe`.
- Header schema: `id`, `name`, `category`, `brand`, `color`, `size`, `price`, `purchaseDate`, `imageUrl`, `notes`, `favorite`, `lastWorn`, `wearCount`, `createdAt`, `updatedAt`.
- Currency default: `S$`. Date fallback timezone: `Session.getScriptTimeZone() || 'Asia/Singapore'`.
- Photos go to a Drive folder named **CLOSETÉ Wardrobe Photos**. Folder ID is stored only in script property `CLOSETÉ_DRIVE_FOLDER_ID` (not in source). New uploads are shared as anyone-with-link, view, and returned as `https://drive.google.com/uc?export=view&id=…`. Do not change Drive permissions while gathering source.

## Client/server API (current site)

The live frontend talks **only** through `google.script.run`: `getItems()`, `saveItem(item)`, `markWorn(id)`. `setupWardrobe()` is for manual editor use. `doGet()` serves HtmlService. A standalone PWA cannot keep `google.script.run` unless it remains hosted as this Apps Script web app.

## Sheets connector check (read-only)

The connected Google Sheets tools can `get_spreadsheet` / `read_range` **only if a spreadsheet ID is already known**. There is no list/search tool in that connector, so accessible spreadsheets could not be enumerated. A unique CLOSETÉ spreadsheet was **not** identified. Do not assume any previously seen「衣櫃收納」sheet.

## Missing for a secure standalone Sheets + Drive API adapter

- The bound spreadsheet ID / URL (must be confirmed by the owner).
- The Drive folder ID (script property; name alone is not unique).
- A public OAuth 2.0 Web client ID, with Google Sheets API and Drive API enabled, OAuth consent, and authorized JavaScript origins for the eventual PWA host. Do **not** invent authless or API-key access to the user’s Sheet or Drive.
- Decision to keep the existing Apps Script `/exec` site unchanged (required).

Implement a genuine PWA (manifest + service worker on a host the project controls), rewrite `google.script.run` to authorized Google APIs, and push to the private repo. Public GitHub Pages hosting is a later choice; the repo should stay private until then.
