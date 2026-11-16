# Legacy CLOSETÉ Apps Script backup

These files are an unmodified backup of the owner-supplied source used to build the PWA. They are not executed by the PWA.

- `Code.gs` — Apps Script backend pasted by the owner. The live web app reads and writes the bound spreadsheet (`SpreadsheetApp.getActiveSpreadsheet()`), tab `Wardrobe`, and uploads photos to a Drive folder named `CLOSETÉ Wardrobe Photos`.
- `Index.html` — clean 766-line frontend extracted from the live `/exec` page.
- `deployed-userHtml-raw.txt` — the exact `userHtml` string Google was serving, including the pasted preamble and markdown fences.
- `deployed-exec-page.html` — the outer HtmlService wrapper (Google shell plus sandbox iframe).
- `SOURCE-NOTES.md` — handoff notes. The spreadsheet ID and Drive folder ID are not in this source.

The deployed Apps Script site must stay as it is. Nothing in this repository redeploys or edits that project.

Live app (do not modify):

https://script.google.com/macros/s/AKfycbxe3EpgaLdJ8DKZNHLNNRc9mS5sHjHH05Mus1QoRN6leSIiFCLBkzIxGVSwB9ibCUzKAQ/exec

This backup is not the older「衣櫃收納」project and it is not the Clothes- repository.
