# CLOSETÉ PWA

Installable wardrobe app for the confirmed Google Sheet. The visual design and wardrobe behavior come from the owner’s latest `Index.html` (three tabs: Overview, Wardrobe, Wishlist). Browser OAuth is **not configured**. `CLIENT_ID` is empty, so the setup gate stays up and the app does not claim a live connection.

The spreadsheet id is owner-supplied client config in `public/config.js`. It is not printed on the page. It does not grant access to wardrobe rows. Tab `Wardrobe`. Currency `S$`. Dates use `Asia/Singapore`.

A read-only header check confirmed that tab and did not read wardrobe rows. This repository is still private until its owner changes visibility in GitHub. The site is not deployed.

## What works in this copy

Opening the app shows a setup screen. No Google request is made until an OAuth web client ID exists and you choose Sign in. **View demo wardrobe** is optional and labeled. It keeps sample pieces in memory and never calls Sheets or Drive.

After a real client ID is added and you sign in, the app uses the Google Identity Services token flow (no client secret) with:

- `https://www.googleapis.com/auth/spreadsheets` to read and update only the confirmed Wardrobe tab
- `https://www.googleapis.com/auth/drive.file` to create a private photo folder and upload files this app creates

New photos are not shared to anyone with the link. The original Apps Script site is left unchanged and is not iframed or called.

## Commands

```bash
npm ci
npm test
npm run build
npm run test:dist
npm run preview
```

Preview: `http://127.0.0.1:4173/closete-pwa/`

## Docs

- [Setup still required, especially OAuth](docs/SETUP.md)
- [GitHub Pages plan](docs/PAGES.md)
- Legacy sources, including the authoritative Index.html, are in `legacy/closete-source/`
