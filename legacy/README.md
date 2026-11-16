# Legacy CLOSETÉ sources

These files are the handoff copy. The PWA does not serve them.

- `Index.html` — authoritative owner paste (986 lines, sha256 `20a6e05bc54b3574c35aaad05c4ca831470fcd4b19571cf9eb1e69bf1db548eb`). Three tabs only: Overview, Wardrobe, Wishlist. This is the UI the PWA follows.
- `Index.extracted-from-exec.html` — older extract from the live Apps Script page, including Outfits and Insights links. Not used.
- `Code.gs` — original Apps Script backend. The live `/exec` deployment is unchanged. The PWA reimplements its sheet rules with the Sheets API instead of calling this script.
- `deployed-userHtml-raw.txt` and `deployed-exec-page.html` — captured HtmlService output, reference only.
- `SOURCE-NOTES.md` — original handoff notes. The spreadsheet ID was confirmed after those notes were written.
