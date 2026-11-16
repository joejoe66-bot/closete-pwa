# Optional GitHub Pages

This repo does not deploy the PWA. `.github/workflows/pages.yml` is `workflow_dispatch` only, so a push does not publish the site. Do not run it until the notes below are acceptable.

The built site uses base path `/closete-pwa/`, which matches a project site at `https://<owner>.github.io/closete-pwa/`.

## Private repository and plan limits

The repository should stay private. Publishing Pages does not require making the git repo public, but the plan and the site’s visibility are separate:

- GitHub Free can serve Pages from **public** repositories only.
- GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server can serve Pages from a **private** repository.
- A Pages site is still **public on the internet** when it is published from a private repository, unless the owner is an organization on GitHub Enterprise Cloud with access control for GitHub Pages enabled. A personal private repo does not get a private website from Pages.

If the site is published, visitors can download the HTML, JavaScript, manifest, and `config.js`. That exposes the spreadsheet ID and the OAuth client ID. Those are not sufficient to read the sheet. Wardrobe rows still require the user’s Google sign-in. Do not put a client secret, refresh token, or access token in `config.js` before publishing; the workflow uploads the built `dist/` directory.

## If you later choose to publish

1. Confirm the GitHub plan can enable Pages on a private repo, and accept that the site itself is public unless enterprise access control applies.
2. In the repo settings, set Pages source to **GitHub Actions**.
3. Add the published origin, for example `https://<owner>.github.io`, to the OAuth client’s authorized JavaScript origins. Origins have no path.
4. Run the **GitHub Pages (optional, manual)** workflow by hand. It runs `npm ci` and `npm run build`, then deploys `dist/`.
5. Open `https://<owner>.github.io/closete-pwa/` and confirm the setup screen or, after `CLIENT_ID` is set, the Google sign-in prompt. A successful Pages deploy is still not a wardrobe connection until that sign-in works.

This project has not run that workflow and has not changed repository visibility.
