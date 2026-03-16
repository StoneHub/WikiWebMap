# WikiWebMap (WikiWeb Explorer)

Explore Wikipedia topics as an interactive graph: expand nodes, search for connections between topics, and visualize link context.

Live: `https://wikiconnectionsmap.web.app/`
Website: `https://monroes.tech`
GitHub: `https://github.com/StoneHub/WikiWebMap`

## Quickstart

### Prerequisites
- Node.js 20+

### Install
- `npm ci`

### Run
- `npm run dev`

### Build
- `npm run build`

### Test
- `npm run test`

### Smoke Test
- `npm install --no-save playwright`
- `npx playwright install chromium`
- `npm run preview -- --host 127.0.0.1 --port 4173`
- `npm run smoke`

## Environment
- Copy `.env.example` to `.env.local` for local overrides.
- `VITE_WIKI_API_CONTACT_EMAIL` is used for the Wikipedia API identification header.
- `VITE_RECAPTCHA_SITE_KEY` enables client-side bot checks when configured.
- See `docs/env-inventory.md` for the release-facing env contract.

## Deployment
- GitHub Actions validates pull requests and publishes Firebase preview channels before merge.
- Merges to `main` deploy to Firebase Hosting live.
- Bluehost is assumed to be used only for DNS or custom-domain management unless you have separate hosting outside this repo.
- See `docs/deployment.md`, `docs/release-checklist.md`, `docs/release-prep.md`, `docs/development-plan.md`, `docs/ux-effects-plan.md`, `docs/ai-api-mcp-plan.md`, and `docs/env-inventory.md` for release workflow details.

## Controls (high level)
- Drag canvas to pan; scroll to zoom.
- Click a node to open details and actions.
- Select up to 2 nodes to search for connections. On desktop you can Shift+Click nodes; on touch devices you can use the node details panel.
- Queued bridge searches run automatically, and the `Search Activity` panel shows progress, pause/resume controls, and whether alternate-bridge search is enabled.
- Alt/Option+Drag box-selects nodes for bulk actions on desktop.

## License
Apache-2.0. See `LICENSE`.

## Ownership, API, and Wikimedia Notice
- This repo is currently Apache-2.0. That means attribution and branding help establish authorship, but they do not prevent someone else from reusing or forking the code under the license terms.
- Set `VITE_WIKI_API_CONTACT_EMAIL` so requests send a descriptive `Api-User-Agent` header to Wikipedia.
- The app rate-limits and caches Wikipedia requests, and `VITE_RECAPTCHA_SITE_KEY` can be used to reduce automated abuse on the client side.
- Wikipedia is a trademark of the Wikimedia Foundation. WikiWebMap is an independent project and is not affiliated with or endorsed by the Wikimedia Foundation.

## Attribution
- Wikipedia/Wikimedia content is licensed under CC BY-SA 4.0.
- This project is not affiliated with or endorsed by the Wikimedia Foundation.
