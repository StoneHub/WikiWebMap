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
- [ ] Brainstorm graph types and data sources
- [ ] Proposal for "spawnable" graphs

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
4. Data visualization planning: define "spawnable graph" formats + data sources.
5. Improve auto-test further (optional "Kevin Bacon" → "Hollywood", reduce timing/polling).
6. Fix local build tooling (`vite build` currently fails due to Rollup optional dependency install).

### Mobile UX Overhaul Prompt
- Menus and overlays overwhelm small screens; consolidate controls into a single icon + drawer or bottom sheet on widths under ~768px.
- Shrink padding/typography for floating panels, and ensure search/results stacks as full-width rows with tap-friendly targets.
- Reserve more canvas space on mobile (reduce persistent chrome); test pan/zoom/drag gestures without hover-only affordances.
- Node details/log panels should dock as slide-up sheets with dismiss handles rather than fixed sidebars on mobile.
