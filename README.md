# CLOSETÉ PWA

Installable wardrobe app for the confirmed Google Sheet. The visual design and wardrobe behavior come from the owner’s latest `Index.html` (three tabs: Overview, Wardrobe, Wishlist). Browser OAuth is **not configured** in this repo, and this app is **not deployed**.

Confirmed target, checked separately with a read-only header verification:

- Spreadsheet `1NqubXEZAIJdBOnK9iru0qR4b2jPc8tRPToR2s9mYCng` (`CLOSETÉ Wardrobe App`)
- Tab `Wardrobe`, sheet id `1746053320`
- Columns `A:O`: `id`, `name`, `category`, `brand`, `color`, `size`, `price`, `purchaseDate`, `imageUrl`, `notes`, `favorite`, `lastWorn`, `wearCount`, `createdAt`, `updatedAt`
- Currency `S$`, dates in `Asia/Singapore`

That check did not read wardrobe rows and did not write. It does not mean this PWA can sign in.

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
- [Optional GitHub Pages](docs/PAGES.md)
- Legacy sources, including the authoritative Index.html, are in `legacy/closete-source/`
