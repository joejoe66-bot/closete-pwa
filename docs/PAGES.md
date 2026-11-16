# GitHub Pages

The owner asked for a public repository and a free GitHub Pages site, plus a hard-to-find address. This file is the deploy plan. It does not change repository visibility, and the workflow has not been run.

The built site uses base path `/closete-pwa/`, which matches a project site at `https://<owner>.github.io/closete-pwa/`.

## What “low discoverability” can and cannot do

`index.html` sends `noindex, nofollow`. `robots.txt` says `Disallow: /`. Both are requests to crawlers. They are not access protection.

A free GitHub Pages project URL is formed from the account name and the repository name. It is not a secret link. Anyone who can guess or is given that address can open the app shell. The setup gate still requires an OAuth client ID before sign-in, and wardrobe rows still require that Google account. Demo pieces are labeled samples, not the live sheet. Photos are not made public.

`robots.txt` in this project is served under `/closete-pwa/robots.txt`. Crawlers only promise to read `robots.txt` from the host root (`https://<owner>.github.io/robots.txt`). The meta tag is the request that applies to the HTML page itself.

## Free plan

GitHub Free serves Pages from **public** repositories. It does not serve Pages from a private personal repository. This repo is still private. Making it public is a GitHub UI step for the owner. This project does not change visibility and does not add billing.

Publishing the site also publishes the files in the repository, including `public/config.js`. That file contains the spreadsheet id and, later, a public OAuth client ID. Neither value reads the sheet by itself. Do not put a client secret, refresh token, or access token there. The Pages workflow uploads `dist/` only.

A second branch, `cursor/closete-pwa-afc5` (pull request 1), is also in the repository. A public repository shows every branch that still exists.

## When the repository is public

1. In the repository settings, set Pages to **GitHub Actions**.
2. Run **GitHub Pages (manual, free public repo)** by hand. It does not run on push. It runs `npm ci` and `npm run build`, then deploys `dist/`.
3. Open `https://<owner>.github.io/closete-pwa/` and confirm the setup screen. An empty client ID means there is still no live wardrobe connection.
4. After a real web client ID exists, add `https://<owner>.github.io` to its authorized JavaScript origins. Origins have no path.

Do not dispatch the workflow while the repository is private. On the free plan that deploy cannot publish.
