# AGENTS.md

## Repo Snapshot
- This is a single-module Vite + React + TypeScript app.
- Most product code lives in `src/`; deployment lives in `.github/workflows/deploy.yml`; release notes and process docs live in `docs/`.
- Pushes to `main` trigger the live Firebase Hosting deploy, so prefer feature branches and PRs unless the user explicitly wants a live `main` update.

## Read First
- Start with `README.md` for setup, scripts, and env vars.
- Read `docs/deployment.md` and `docs/release-checklist.md` before changing CI or release behavior.
- When touching the new layout/mobile flow, read `docs/ux-effects-plan.md`.

## Working Rules
- Read the existing code and docs before changing behavior.
- Prefer minimal, local changes over broad rewrites.
- If a task spans multiple files, the most likely hotspots are `src/App.tsx`, `src/GraphManager.ts`, `src/components/*`, `src/hooks/useGraphState.ts`, and matching tests under `src/`.
- Do not commit generated local artifacts such as `.preview.*` or `.playwright-cli/`.
- If instructions or release steps seem stale, call that out explicitly in the handoff.

## Verification
- Install dependencies with `npm ci`.
- Core local checks are `npm run lint`, `npm run test`, and `npm run build`.
- Use `npm run check` as the default pre-merge gate.
- If UI, search, or mobile interaction behavior changes, also run `npm run smoke`.

## Done Means
- The requested behavior is implemented on the intended branch.
- `npm run check` passes locally.
- `npm run smoke` passes when UI/search/mobile behavior changed.
- Any required docs or workflow notes were updated alongside the code change.
