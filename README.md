# CLOSETÉ

A mobile-friendly progressive web app for the CLOSETÉ digital wardrobe. It keeps the original visual design, the `Wardrobe` sheet schema, and Singapore dollar (`S$`) prices. It is a real app shell with its own manifest and service worker. It does not embed or proxy the existing Apps Script page.

The original site is left untouched:

https://script.google.com/macros/s/AKfycbxe3EpgaLdJ8DKZNHLNNRc9mS5sHjHH05Mus1QoRN6leSIiFCLBkzIxGVSwB9ibCUzKAQ/exec

This repository is not the older「衣櫃收納」app and it is not the Clothes- repository. The Apps Script backup is in [`legacy/`](legacy/README.md).

## What is finished, and what is not

The app code, tests, and Pages workflow are in this repo. That is not the same as a live connection or a public deploy.

- **Not connected.** No spreadsheet ID, Drive folder ID, or OAuth client was available. The screen stays on Setup until those are stored on the device and a signed-in read of the `Wardrobe` tab succeeds. A stored ID is not reported as connected.
- **Not deployed.** The repository is private and GitHub Pages is not enabled. The workflow in `.github/workflows/pages.yml` is ready for later. It does not change visibility or billing. Private Pages needs a plan that includes it; until then a run of that workflow fails closed.
- **No client secret.** Browser sign-in uses Google Identity Services' token client (a public OAuth client ID). Nothing in this repo is a client secret, API key, or access token. Tokens stay in tab memory and are not written to `localStorage` or the service worker.
- **Demo mode is opt-in.** The "Try a local demo" button shows three obvious sample pieces in the tab only. It never writes to Google and it is not a stand-in for the real wardrobe.

## Features carried over

The original frontend's behavior is what this version implements:

- Overview and Wardrobe show the collection.
- Search, category filters, add, edit, favorite, and "Wore it".
- Photos can be taken, imported, removed, or pasted as a URL. New files are resized in the browser before upload.
- Wishlist filters favorites.
- Prices use `S$` and `en-SG` formatting.
- Sheet columns stay `id`, `name`, `category`, `brand`, `color`, `size`, `price`, `purchaseDate`, `imageUrl`, `notes`, `favorite`, `lastWorn`, `wearCount`, `createdAt`, `updatedAt`.

Outfits and Insights are not separate finished screens. The original page only switched the heading (and, for Outfits, not even that). This version says so on those tabs and shows the same list.

## Behavior that differs from Apps Script

These differences are intentional. They are not silent.

| Original Apps Script | This PWA |
| --- | --- |
| `google.script.run` inside the Google sandbox | Google Identity Services plus the Sheets and Drive REST APIs. `google.script.run` cannot run on GitHub Pages. |
| Script lock across users | A lock only inside this tab. Two devices can still race. |
| Photos are always shared as anyone with the link | Photos are private unless Setup's link-sharing box is checked. Private photos display here with an authenticated download while the sign-in is valid. They will not appear in the old app. |
| Folder is found by name or created automatically | This app does not search Drive by name (`drive.file` cannot do that). Paste the existing folder ID, or press **Create private photo folder** after sign-in. A created folder is new; it may not be the Apps Script folder. |
| Date timezone is the script timezone, falling back to `Asia/Singapore` | The script timezone was not in the source, so wear dates use `Asia/Singapore`. |
| Reads and writes the bound spreadsheet, whatever it is | Reads and writes only the spreadsheet ID stored on this device. |

Wear dates are written as `yyyy-MM-dd` text with `valueInputOption=RAW`, so Sheets does not reinterpret them. Existing date-serial cells are still read.

## Setup the owner still has to do

No Google call succeeds until every required field below is real. Saving the form only stores them in this browser.

1. In Google Cloud, for the account that owns the wardrobe, enable the **Google Sheets API** and the **Google Drive API**.
2. Configure the OAuth consent screen. Add the scopes below. If the app is in Testing, add the Google account that owns the sheet as a test user.
3. Create an OAuth client of type **Web application**. Do not create or paste a client secret. This app does not use one.
4. Add this site's origin under **Authorized JavaScript origins**. For local preview that is `http://127.0.0.1:4173`. A later Pages origin would be `https://joejoe66-bot.github.io`. No redirect URI is required for the Google Identity Services token client.
5. Copy the client ID (`….apps.googleusercontent.com`) into Setup.
6. Copy the spreadsheet ID from the wardrobe sheet URL (`/spreadsheets/d/<id>/`). The bound spreadsheet ID was not in `Code.gs`.
7. Optional: paste the existing Drive folder ID for **CLOSETÉ Wardrobe Photos** (the Apps Script property `CLOSETÉ_DRIVE_FOLDER_ID`). If it is omitted, sign in and use **Create private photo folder**. `drive.file` can use a folder this app created, or one this client is later allowed to open. Pasting an ID this client cannot access returns a permission error and does not switch to a different folder.
8. Press **Sign in with Google** and wait until the status says **Connected**. That word is shown only after a read of the sheet succeeds.

The page content security policy allows Google's sign-in script and the inline styles that script injects. It does not allow other scripts.

Scopes requested:

- `https://www.googleapis.com/auth/spreadsheets` — read and write the one spreadsheet ID. `drive.file` alone cannot open an existing spreadsheet the owner already has just because the ID is known.
- `https://www.googleapis.com/auth/drive.file` — create and upload photos in folders this app creates or the user opens. The full Drive scope is not requested.

## Local preview

```bash
npm ci
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/closete-pwa/`.

The service worker caches the app shell (HTML, CSS, JS, manifest, icons) under `/closete-pwa/` and will not cache Sheets, Drive, or any request with an `Authorization` header. Offline reloads can show the shell. They do not show wardrobe rows, and the app does not queue a sync. After an update is downloaded, the page asks before reloading.

Install instructions for iPhone/iPad (Safari: Share, Add to Home Screen) and Android (Chrome: Install app) are on the Install button. Installing does not copy the Google session.

## Scripts

- `npm test` — schema mapping, save/wear semantics, Google request behavior, missing config, offline and permission errors, manifest, icons, and service-worker scope.
- `npm run build` — Vite build with base path `/closete-pwa/`.
- `npm run check` — checks `dist/` for the base path, manifest, worker, icons, and accidental secrets.
- `npm run icons` — redraws the local hanger icons.
