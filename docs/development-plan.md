# Development Plan

## Current state

This repo is now in a safer release-ready state than it was at clone time:
- Env handling is standardized around `VITE_WIKI_API_CONTACT_EMAIL` and `VITE_RECAPTCHA_SITE_KEY`.
- Pull requests validate through lint, unit tests, build, and Firebase preview deployments before merge.
- Suggested-path searches now reset and restore graph state deterministically on abort/failure.
- Mobile guidance and destructive actions are safer.
- The repo now has unit coverage for `WikiService`, `runPathfinder`, and `useGraphState` reset/restore behavior.
- Session diagnostics now include both connection logs and captured client runtime errors.
- `web` mode now seeds root topics from root-count-aware positions instead of total-node-count drift, which keeps first-load layouts more balanced.
- Project attribution and external links now live with the bottom-left graph tools on desktop, with matching ownership/Wikimedia notice language in the UI and docs.
- Neutral placeholder art now avoids leaning on Wikimedia-looking fallback branding when a topic has no thumbnail.
- Link-strength cues are now surfaced in both the legend and connection drawer, so “strong ties” are no longer hidden inside rendering math alone.
- The old green `Search Terminal` is now a calmer `Search Activity` panel with automatic queue messaging, optional detail logs, and duplicate-search prevention.

Renderer planning note:
- The next radically different visualization experiment is a React Flow-based `Structured View`; see `docs/react-flow-structured-view-plan.md`.

## Recommended phase order

### Phase 1: Release the current hardening work
Goals:
- Ship the current stabilization, test, and documentation work to production.
- Verify the new CI path and preview workflow on a real PR.

Changes included:
- Config/env cleanup
- Search/reset reliability fixes
- Mobile interaction fixes
- CI validation and unit tests
- Session diagnostics and release docs

Gate:
- Merge only after the PR preview, CI checks, and release checklist all pass.

### Phase 2: AI API foundation
Goals:
- Extract the product’s core capabilities into a stable read-only backend contract.
- Stop depending on browser state for AI access.

Changes:
- Add a small server-side API layer for topic lookup, neighbors, and pathfinding.
- Centralize caching, rate limiting, canonical title resolution, and bounded responses.
- Keep it read-only for the first version.

Recommended order:
1. Contract definition
2. Server scaffolding
3. `resolve_topic`
4. `get_topic`
5. `get_neighbors`
6. `find_paths`

### Phase 3: MCP integration
Goals:
- Let agents use WikiWebMap as a structured knowledge/navigation tool.

Changes:
- Add an MCP server that wraps the read-only API.
- Expose stable tools with predictable JSON outputs.
- Add request budgets and observability before wider rollout.

Recommended order:
1. Finalize HTTP/API contract
2. Add MCP tool mapping
3. Add auth/rate controls if public
4. Add example prompts and integration docs

### Phase 4: Architecture cleanup
Goals:
- Reduce the maintenance risk of oversized change hotspots.

Changes:
- Split `src/App.tsx` by orchestration responsibility.
- Split `src/GraphManager.ts` by simulation, rendering, and interactions.
- Continue pulling pure logic into testable modules.

Recommended order:
1. Extract path/search orchestration
2. Extract graph panel composition
3. Extract graph rendering modules
4. Shrink imperative coupling points

### Phase 5: UX and operability polish
Goals:
- Improve trust, clarity, and production operability after the main reliability work is stable.

Changes:
- Better first-run onboarding and empty states
- More polished mobile drawers/sheets
- Optional remote error reporting
- Better release notes and rollback discipline

### Phase 6: Structured renderer experiment
Goals:
- Test a genuinely different alternate renderer without replacing the current graph.

Changes:
- Add a React Flow-based `Structured View` fed by existing graph/search state.
- Emphasize branches, paths, and hierarchy over force-directed motion.
- Keep `Cosmos mode` deferred to a later VR-oriented track.

Recommended order:
1. Read-only React Flow spike
2. Deterministic structured layout
3. Selection/details sync
4. Branch collapse and manual organization

## Prioritized backlog

| ID | Area | Goal | Why it matters | Effort | Risk | Target phase |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Release | Ship the current hardening safely | Unlocks production value from the work already completed | Small | Low | Phase 1 |
| P2 | API | Define the read-only AI/API contract | Prevents MCP work from coupling to browser internals | Medium | Low | Phase 2 |
| P3 | Backend | Add a small server-side data layer | Needed for caching, rate limits, and deterministic AI responses | Medium | Medium | Phase 2 |
| P4 | MCP | Add tool-based AI access on top of the API | Enables agent use without exposing UI-only implementation details | Medium | Medium | Phase 3 |
| P5 | Architecture | Break up `App.tsx` and `GraphManager.ts` | Lowers regression risk for future work | Large | Medium | Phase 4 |
| P6 | UX | Improve onboarding and mobile drawer polish | Increases usability and product trust | Medium | Low | Phase 5 |
| P7 | Observability | Add remote client error reporting | Makes live issues easier to diagnose after release | Medium | Low | Phase 5 |

## Immediate next improvements

1. Add a one-click `Spread Roots` action so users can quickly recreate the “pull major topics apart, let the inner nodes congregate” layout they naturally discovered.
2. Add a small server-side or edge cache/proxy layer for Wikipedia requests so abuse control, request budgets, and API identification are no longer purely client-enforced.
3. Let users pin a `search recipe` from the activity panel, such as “find alternate bridges” or “pause after first result,” so repeated exploration sessions feel more intentional.
4. Add a `connection lens` mode that temporarily brightens only the strongest ties around a focused topic.

## Branch strategy

- Use a release PR to merge the current hardening work to `main`.
- Start the AI API work on a separate branch after the current release is live.
- Keep the MCP adapter in its own branch until the API contract is stable.
- Treat the `App.tsx` / `GraphManager.ts` refactor as a separate branch from the backend/API effort.
