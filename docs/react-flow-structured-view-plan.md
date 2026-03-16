# React Flow Structured View Plan

## Goal

Create a genuinely different alternate renderer for WikiWebMap using React Flow.

This should not feel like the current force-directed graph with slightly different gravity.
The first prototype should feel more like:
- a knowledge map
- a subway diagram
- a branching research board

The current D3 graph remains the default exploration surface while this mode is proven out.

## Why React Flow

React Flow is a strong fit for the next experiment because it gives us:
- a clear node-and-edge rendering layer separate from the current D3 simulation
- better support for structured layouts, grouped branches, and deliberate routing
- a React-native interaction model for panels, selection, viewport state, and overlays
- room to pair with ELK.js later for more formal layered/tree layouts

Inference:
- React Flow alone is the rendering shell we want first.
- ELK.js is the most likely second step if we want stronger automatic layout rules after the MVP.

## Product Direction

### What this mode should emphasize
- clear branch structure from the seed topics
- explicit path storytelling between two chosen topics
- lighter, secondary treatment for cross-links
- stronger visual hierarchy between roots, branches, leaves, and bridges
- easier pruning and manual arrangement than the current physics-heavy view

### What this mode should avoid
- pretending to be a freeform force graph
- overwhelming users with too many visible leaves on first render
- trying to replace every current graph interaction in the first prototype

## Mode Concept

Working name:
- `Structured View`

Possible later names:
- `Atlas`
- `Map`
- `Pathboard`

Initial framing:
- `Web` stays the organic force graph
- `Forest` stays the guided branch-focused D3 layout
- `Structured View` becomes the radically different React Flow renderer

## Scope For The First Prototype

### In scope
- new alternate renderer using React Flow
- reuse the existing graph/search/pathfinding data already managed by the app
- convert the current graph state into React Flow nodes and edges
- render roots and branches in stable columns or lanes
- visually separate cross-links from primary tree/path edges
- sync node selection with the existing details panel
- support viewport pan/zoom and node selection
- support collapsing or hiding sub-branches at the UI level

### Out of scope
- removing the existing D3 graph
- full parity with every drag/gesture behavior on day one
- multi-user editing
- VR rendering
- replacing the production layout engine everywhere at once

## Technical Approach

### Data pipeline
1. Keep `useGraphState` and the current search/pathfinding state as the source of truth.
2. Add a transformation layer that derives React Flow `nodes` and `edges` from existing graph state.
3. Tag edges as:
   - primary branch edges
   - path edges
   - cross-links
4. Tag nodes as:
   - roots
   - branch nodes
   - leaves
   - highlighted path nodes

### Layout strategy

#### MVP layout
- Start with a deterministic custom layout, not physics.
- Place seed/root topics in the first column or top lane.
- Place first-discovered descendants in adjacent columns/rows by depth.
- Reserve a separate visual treatment for bridging edges between branches.

#### Likely upgrade
- Add ELK.js after the MVP if we want:
  - cleaner layered routing
  - better handling of dense branch trees
  - smarter spacing for large path results

## Proposed File Shape

Most likely affected files:
- `src/App.tsx`
- `src/hooks/useGraphState.ts`
- `src/features/layout/layoutConfig.ts`
- `src/components/GraphControls.tsx`

New likely files:
- `src/components/StructuredFlowView.tsx`
- `src/features/structured-view/toReactFlowElements.ts`
- `src/features/structured-view/structuredLayout.ts`
- `src/features/structured-view/nodeTypes.tsx`
- `src/features/structured-view/edgeTypes.tsx`

Likely supporting tests:
- `src/features/structured-view/toReactFlowElements.test.ts`
- `src/features/structured-view/structuredLayout.test.ts`

## Implementation Phases

### Phase 0: Spike
Goal:
- prove the renderer can coexist with the current app shell

Tasks:
- add React Flow dependency
- render a static alternate surface from existing graph state
- show roots, branches, and cross-links with distinct styles
- verify selection can open the existing details panel

Done:
- app can switch into a read-only structured renderer without breaking build/tests

### Phase 1: MVP
Goal:
- make the structured view usable for real exploration

Tasks:
- add a third layout/view mode in controls
- implement deterministic layout from graph depth/tree metadata
- support branch collapse/expand
- support selection, path highlighting, and viewport fit
- tune styling so the mode feels intentionally different from `Web` and `Forest`

Done:
- user can explore a seeded topic or suggested path in the structured view
- branches are legible without manual cleanup in common cases
- cross-links are readable but visually secondary

### Phase 2: Editing and organization
Goal:
- make the mode useful for curating the map, not just viewing it

Tasks:
- allow manual node repositioning with persisted local layout overrides
- allow branch pinning and selective hide/show
- add commands for focus, isolate branch, and reveal cross-links

Done:
- users can prune and organize branches in a way that feels better than the force graph for structured tasks

### Phase 3: Layout intelligence
Goal:
- improve large-graph readability

Tasks:
- evaluate ELK.js integration
- improve edge routing for dense graphs
- add heuristics for staged reveal of leaves

Done:
- medium-sized graphs remain readable without becoming spaghetti

## UX Rules

- Do not show all leaves immediately if that makes the map unreadable.
- Primary branch structure should read at a glance.
- Cross-links should inform, not dominate.
- Clicking a node should still feel like one product, not a separate app.
- The new mode should have stronger typography and edge hierarchy than the current graph.

## Risks

- React Flow can feel too diagram-like if we over-constrain it.
- A poor first layout will make the mode feel worse than the current graph.
- Duplicating interaction logic can create drift if state ownership is unclear.

## Recommended Branch

- `codex/react-flow-structured-view`

## Definition Of Done For The First Build Session

- React Flow is added and renders from real app data.
- A new `Structured View` mode can be toggled in the UI.
- Existing selection/details behavior still works in that mode.
- `npm run check` passes.
- If interaction behavior changes materially, `npm run smoke` is updated or explicitly noted as pending.

## Later / Separate Work

- Keep `Cosmos mode` out of the main web app for now.
- Treat `Cosmos mode` as a future VR-oriented integration using a different rendering stack.
