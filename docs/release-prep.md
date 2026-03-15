# Release Prep

## Release scope

This release is the stabilization and release-hardening pass for the production WikiWebMap frontend.

Included in scope:
- Env/config cleanup
- Firebase PR preview flow
- CI validation with lint, tests, build, and smoke coverage in workflow
- Graph reset/restore reliability improvements
- Safer mobile interaction guidance and bulk actions
- Session diagnostics panel improvements
- Release docs and env inventory

Out of scope:
- Backend/API introduction
- MCP server implementation
- Large `App.tsx` / `GraphManager.ts` refactor

## Local validation completed

Completed in this workspace:
- `npm run check`

This currently verifies:
- ESLint
- Vitest unit tests
- TypeScript compile
- Production Vite build

## Merge requirements

Before merging to `main`:
1. Open a PR from the working branch.
2. Verify GitHub Actions passes `validate`, `smoke`, and preview deployment.
3. Review the Firebase preview deployment on desktop and mobile.
4. Confirm hosting env values are configured:
   - `VITE_WIKI_API_CONTACT_EMAIL`
   - `VITE_RECAPTCHA_SITE_KEY`
5. Walk through `docs/release-checklist.md`.

## Suggested merge message

`Release hardening: config cleanup, preview deploys, search reset fixes, mobile UX, tests, and diagnostics`

## Post-merge checks

After the live deploy completes:
- Open `https://wikiconnectionsmap.web.app/`
- Add a topic and open node details
- Run and abort a suggested-path search
- Check the mobile layout
- Open the diagnostics panel and confirm there are no obvious runtime errors

## If something goes wrong

- Revert the offending commit in a new PR
- Let CI redeploy the previous known-good state
- Capture the incident details in the PR notes and release checklist
