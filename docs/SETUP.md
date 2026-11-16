# Setup still required

This repository does not contain an OAuth client ID, client secret, access token, or refresh token. `public/config.js` ships with `CLIENT_ID: ''`. Until that value is a real Google **web** client ID, the app stays on the setup screen and does not claim a live connection.

The spreadsheet ID below is the confirmed wardrobe file. It is an identifier, not a credential. Access still depends on the Google account you sign in with.

| Setting | Value |
| --- | --- |
| `SPREADSHEET_ID` | Already set in `public/config.js`. Leave that value. It is not a password, and it is not shown on the page. |
| `SHEET_NAME` | `Wardrobe` |
| `SHEET_ID` | Already set in `public/config.js` (the confirmed Wardrobe tab). |
| `CURRENCY` | `S$` |
| `TIMEZONE` | `Asia/Singapore` |
| Drive folder | Not known. Name to create: `CLOSETÉ Wardrobe Photos` |

## Why this architecture

`google.script.run` works only inside the existing Apps Script HtmlService page. A standalone PWA cannot call it. The live site is left as it is:

`https://script.google.com/macros/s/AKfycbxe3EpgaLdJ8DKZNHLNNRc9mS5sHjHH05Mus1QoRN6leSIiFCLBkzIxGVSwB9ibCUzKAQ/exec`

An iframe or link wrapper would still be that old page, not an installable app on a path this repo controls. Authless JSONP or an API key would expose the sheet without a user grant. No Google tokens were provided, so the supported browser approach is [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model) token client plus the Sheets and Drive REST APIs. The token stays in page memory for the visit. It is not written to `localStorage`, the repo, or the service-worker cache. The only local value stored is the Drive folder ID you choose.

`drive.file` cannot search all of Drive, so the app does not look up a folder by name (that could also bind the wrong folder). You create one, or paste an ID this same OAuth client created. Uploads do not call the Drive permissions API and are not switched to “anyone with the link”.

The Sheets scope is the narrow scope that can edit a spreadsheet. There is no per-file Sheets scope. Writes use `valueInputOption=RAW`. Text that starts with `=`, `+`, `-`, `@`, or a tab is stored with a leading apostrophe so it cannot become a formula. Before any read or write, the app checks the tab title `Wardrobe` and sheet id `1746053320`, and it checks that `A1:O1` is the confirmed header. A mismatch stops the call.

Saving a piece still preserves `wearCount`, `lastWorn`, and `createdAt` from the sheet row. `markWorn` updates only those wear cells plus `updatedAt`, using the current date in `Asia/Singapore`. A missing name, a missing photo folder, or being offline fails before a write. Offline edits are not queued. Demo data is never written and is never shown unless you press **View demo wardrobe**.

## Create the OAuth client

Do this in the Google account that can edit the wardrobe spreadsheet. Do not paste a client secret into the repo, `config.js`, or the deployed site.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or choose a project.
2. Enable **Google Sheets API** and **Google Drive API**.
3. Configure the OAuth consent screen.
   - User type: External, unless this is a Workspace-internal app.
   - While the app is in **Testing**, add the wardrobe’s Google account under Test users. Unverified sensitive scopes (including Sheets) only work for those test users.
   - Add the scopes `https://www.googleapis.com/auth/spreadsheets` and `https://www.googleapis.com/auth/drive.file`.
4. Create credentials → OAuth client ID → application type **Web application**.
5. Authorized JavaScript origins must be exact origins, with no path:
   - `http://localhost:4173` for the local preview
   - `http://127.0.0.1:4173` if you open that host instead
   - the `https` origin later, only if you actually publish
6. The GIS token flow does not use a client secret or a redirect URI. Do not download or commit the secret JSON.
7. Put the client ID, which ends in `.apps.googleusercontent.com`, into `CLIENT_ID` in `public/config.js`.
8. Rebuild with `npm run build`. For a local check, `npm run preview` and open `http://127.0.0.1:4173/closete-pwa/`.
9. Choose **Sign in**, accept the two scopes, then create the private photo folder before the first picture. Reload drops the access token; sign in again. That is intentional.

The in-app Install help covers Android/Chrome/Edge and iPhone/iPad Safari (Share → Add to Home Screen). iOS will not install the PWA from Chrome.

## What was deliberately not done

- No request was sent to the live spreadsheet or Drive from this project.
- No one-with-the-link sharing.
- No Outfits or Insights screen. The latest Index.html does not have those tabs.
- The older「衣櫃收納」/ `Clothes-` project is not reused.
- Repo visibility was not changed, and nothing here turns on billing or GitHub Pages.
