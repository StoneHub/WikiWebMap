# WikiWebMap (WikiWeb Explorer)

Explore Wikipedia topics as an interactive graph: expand nodes, search for connections between topics, and visualize link context.

Live: `https://wikiconnectionsmap.web.app/`

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

## Environment
- Copy `.env.example` to `.env.local` for local overrides.
- `VITE_WIKI_API_CONTACT_EMAIL` is used for the Wikipedia API identification header.
- `VITE_RECAPTCHA_SITE_KEY` enables client-side bot checks when configured.
- See `docs/env-inventory.md` for the release-facing env contract.

## Deployment
- GitHub Actions validates pull requests and publishes Firebase preview channels before merge.
- Merges to `main` deploy to Firebase Hosting live.
- Bluehost is assumed to be used only for DNS or custom-domain management unless you have separate hosting outside this repo.
- See `docs/deployment.md`, `docs/release-checklist.md`, and `docs/env-inventory.md` for release workflow details.

## Controls (high level)
- Drag canvas to pan; scroll to zoom.
- Click a node to open details and actions.
- Select up to 2 nodes to search for connections. On desktop you can Shift+Click nodes; on touch devices you can use the node details panel.
- Alt/Option+Drag box-selects nodes for bulk actions on desktop.

## License
Apache-2.0. See `LICENSE`.

## Attribution
- Wikipedia/Wikimedia content is licensed under CC BY-SA 4.0. This project is not affiliated with the Wikimedia Foundation.
