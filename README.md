# Scramjet for GitHub Pages

This repository builds the Mercury Workshop Scramjet client and publishes the
static output to GitHub Pages. It is based on
[`MercuryWorkshop/scramjet`](https://github.com/MercuryWorkshop/scramjet).

## Deploy

1. Create a GitHub repository and upload this project, keeping the default
   branch named `main`.
2. Open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Open **Settings → Secrets and variables → Actions → Variables** and create
   an optional repository variable named `WISP_URL`. Its value must be a secure
   WebSocket URL such as `wss://proxy.example.com/wisp/`.
4. Open **Actions → Deploy Scramjet → Run workflow** (or push a commit).
5. When the job finishes, use the URL shown by the `deploy` job.

The workflow defaults to `wss://anura.pro/` when `WISP_URL` is not set. That is
a third-party public endpoint suitable for trying the site, not a reliability
or privacy guarantee. For a real deployment, use a Wisp service you operate or
trust.

## Why a transport is still required

GitHub Pages only serves static files. The Scramjet client and service worker
can live there, but they cannot open arbitrary outbound TCP connections on
their own. Wisp provides that network transport over WebSocket. This means the
front end is hosted entirely on GitHub Pages, while proxied traffic passes
through the configured Wisp endpoint.

Users can change the endpoint later in Scramjet's **Settings** screen. Settings
are stored locally in that browser.

## Updates

The installed web app checks for a newly deployed service worker every 15
minutes and activates it automatically when **Automatically install deployed
updates** is enabled. Dependabot opens weekly dependency update pull requests;
these remain reviewable so upstream changes cannot silently overwrite the
custom interface. The deployment workflow also performs a weekly clean build.

## Local development

The full build requires recent Node.js, pnpm, Rust nightly, `wasm-bindgen`,
`wasm-opt`, and the project's `wasm-snip` fork. The included GitHub Actions
workflow installs the build toolchain for you.

```sh
pnpm install
pnpm run rewriter:build
pnpm run build
pnpm dev
```

Use this only on networks and systems where you have permission, and review the
privacy and acceptable-use terms of any transport endpoint you configure.

## License

AGPL-3.0-only, matching the upstream project.
