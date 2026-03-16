# WikiWebMap Enhancements — Status & Plan

This project is moving toward an imperative D3 `GraphManager` + React UI shell. Recent work added link context, thumbnails, selection metadata, and UI component extraction.

## Current status (from code + git history)

### Connection Line Logic
- [x] Highlight connection line on hover (clickable styling in `src/GraphManager.ts`)
- [~] Connection click shows context “attached” to the line (`LinkContextPopup` anchored via `getLinkScreenCoordinates`)
- [x] Multiple link contexts without overlap (`LinkContextsLayer` collision/stacking)
- [~] Refactor `App.tsx` by extracting components/helpers (significantly smaller, still central state hub)

### Bulk Selection & Actions
- [~] Click-and-drag (box) selection in `GraphManager` (implemented + wired; needs UX polish)
- [x] Visualize selected nodes (`isSelected` metadata wired for both path + box selection)
- [ ] Bulk deletion UX (drag-to-trash removed to avoid accidental deletes; revisit safer multi-select delete options)

### Data Visualization Planning
- [~] Brainstorm graph types and alternate renderers
- [ ] Prototype a React Flow-based structured view for a more radically different map mode
- [ ] Define "spawnable" graph/view presets and the data they need
- [ ] Defer "Cosmos mode" to a future VR integration instead of the main web app

### Auto-Test Reliability
- [~] Replace “Facebook -> Typo” auto-test with deterministic path (now seeds `Physics` + `Science`)
- [ ] Ensure it runs smoothly in all browsers (no test harness; current auto-test uses timing/polling)

### Visual Feedback for History
- [ ] Track “Viewed” state for nodes (no viewed/read set yet)
- [~] Distinct style for Expanded nodes (expanded styling exists); Viewed styling not implemented

### Deployment Prep
- [~] Configurable API identification via Settings + env (`Api-User-Agent` header + `.env.example`)
- [x] Add API contact email field to Settings UI
- [ ] Change auto-test to “Kevin Bacon” -> “Hollywood” (optional alternate deterministic route)
- [x] Add `.env.example` guidance

## Proposed plan (next implementation steps)
1. Add trash UI + bulk delete (button + drop-zone affordance), and keep selection visualization in sync.
2. Polish bulk selection UX (selection modifier keys, clear selection, avoid conflicts with path endpoint selection).
3. Add “Viewed” state and styling (clicked/read), differentiating from “Expanded”.
4. Prototype the first radically different renderer using React Flow as a structured alternate view.
5. Define "spawnable graph" formats + data sources around that renderer experiment.
6. Improve auto-test further (optional "Kevin Bacon" → "Hollywood", reduce timing/polling).

### Smarter Connection Discovery (ideas backlog)
- Use entity extraction on summaries/sections to add unlinked mentions as low-confidence candidate nodes; resolve via `resolveTitle`.
- Sample backlinks (“What links here”) and rank by link density/context overlap to surface missed related pages.
- Add co-occurrence/context edges (same paragraph/section) with snippets as justification; make them toggleable and low weight.
- Leverage categories/templates/infobox types to cluster related nodes and propose expansions.
- Fold redirects/aliases (lead bold terms) into search/expansion to avoid dead ends.

### Mobile UX Overhaul Prompt
- Menus and overlays overwhelm small screens; consolidate controls into a single icon + drawer or bottom sheet on widths under ~768px.
- Shrink padding/typography for floating panels, and ensure search/results stacks as full-width rows with tap-friendly targets.
- Reserve more canvas space on mobile (reduce persistent chrome); test pan/zoom/drag gestures without hover-only affordances.
- Node details/log panels should dock as slide-up sheets with dismiss handles rather than fixed sidebars on mobile.
