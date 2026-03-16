# UX And Web Effects Plan

## Goal

Make WikiWebMap feel more legible, more intentional, and more polished without destabilizing the production graph experience.

This plan focuses on:
- first-run clarity
- mobile usability
- interaction feedback
- visual hierarchy
- motion/effects that support understanding instead of distracting from it

## Design direction

The product should feel like:
- a research instrument, not a generic dashboard
- visually alive, but still readable
- fast and tactile on desktop
- guided and spacious on mobile

Core principles:
- Motion should explain state changes.
- Effects should reinforce graph relationships.
- Panels should never compete with the graph for attention.
- The first 30 seconds of use should feel obvious.

## Biggest current UX gaps

### 1. First-run orientation is still weak
- New users do not get a strong explanation of what to do first.
- Suggested paths help, but the screen still relies on inference.

### 1a. First-load spatial rhythm still needs refinement
- Root topics now seed more intelligently, but web mode still needs stronger first-load balance when multiple major topics are added quickly.
- The most successful layouts still happen after a user drags roots outward and lets inner topics settle between them.

### 2. Mobile feels functional, not polished
- The mobile sheets are safer now, but they still feel like adapted desktop UI.
- Important actions are present, but the experience is not yet elegant.

### 3. Visual hierarchy is flat in places
- The search box, graph, connection context, settings, and diagnostics all compete.
- There is not yet a strong “primary task” rhythm on load.

### 3a. Topic visuals are improving but still have room to mature
- Nodes now have softer halos and better root emphasis, but the graph still does not fully communicate connection importance at a glance.
- Link weight and branch significance are still more present in the data than in the visuals.

### 4. Motion is mostly utilitarian
- The graph has energy, but UI transitions and contextual reveals are still basic.
- There is room for effects that make cause-and-effect easier to understand.

### 5. Trust/polish is improving but not complete
- The product is closer to professional release quality now, but the brand/system still needs a more cohesive finish.

## Recommended rollout

### Phase 0: Space and trust pass
Goal:
- Make the first-loaded graph feel more balanced and make project ownership/independence clearer without crowding the main panel.

Changes:
- Keep root topics on soft perimeter anchors in `web` mode instead of letting total node count fling them outward.
- Preserve the lower-left authorship/trust strip as part of the graph tool area rather than the intro panel.
- Continue using neutral custom placeholder artwork instead of anything that could read as Wikimedia branding.

Suggested UI work:
- Tune soft-anchor strength and perimeter radius logic in [GraphManager.ts](/C:/Users/monro/Codex/WikiWebMap/src/GraphManager.ts)
- Tune first-seed and multi-seed spawn logic in [useGraphState.ts](/C:/Users/monro/Codex/WikiWebMap/src/hooks/useGraphState.ts)
- Keep attribution and external-link surfaces coordinated between [GraphControls.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/GraphControls.tsx), [SearchOverlay.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/SearchOverlay.tsx), and [README.md](/C:/Users/monro/Codex/WikiWebMap/README.md)

Risk:
- Low

### Phase 1: Clarity pass
Goal:
- Make the product easier to understand in the first minute.

Changes:
- Replace the current “just search” feeling with a stronger first-run prompt.
- Add a short guided intro block above or below the search input.
- Clarify the value of suggested paths with better microcopy.
- Improve empty-state language for path search, logs, and connection context.

Suggested UI work:
- Add a “Start here” card in [SearchOverlay.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/SearchOverlay.tsx)
- Add one-line purpose text under the title
- Give suggested paths short category labels such as “Science”, “Culture”, or “Surprising”
- Refine helper text in [SearchStatusOverlay.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/SearchStatusOverlay.tsx)

Risk:
- Low

### Phase 2: Mobile UX pass
Goal:
- Make the mobile experience feel intentionally designed, not merely adapted.

Changes:
- Turn node details into a more polished bottom sheet with snap-point behavior styling.
- Make connection context feel like a real mobile drawer instead of a floating status panel.
- Prevent panel overlap between search, status, node details, and diagnostics.
- Improve touch-target sizes and spacing consistency.

Suggested UI work:
- Refine [NodeDetailsPanel.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/NodeDetailsPanel.tsx)
- Refine [ConnectionStatusBar.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/ConnectionStatusBar.tsx)
- Revisit mobile layout in [GraphControls.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/GraphControls.tsx)
- Consider a mobile-specific diagnostics entry point in [LogPanel.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/LogPanel.tsx)

Risk:
- Medium

### Phase 3: Motion and effects pass
Goal:
- Add effects that teach the graph and reward interaction.

Changes:
- Animate panel entrances with consistent timing and easing.
- Add subtle reveal/stagger behavior for suggested paths and search results.
- Make path discovery feel more cinematic when a result resolves.
- Add better hover/focus lighting for nodes and connections.
- Add a soft “state handoff” animation when restoring graph state after an aborted search.

Suggested effects:
- Search panel fade/slide on first load
- Node details sheet spring-in on mobile
- Context drawer expand/collapse animation
- Path result pulse or trace effect in [GraphManager.ts](/C:/Users/monro/Codex/WikiWebMap/src/GraphManager.ts)
- Softer background parallax or light-field drift in [LensingGridBackground.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/LensingGridBackground.tsx)

Guardrails:
- Keep transitions short
- Respect `prefers-reduced-motion`
- Avoid effects that obscure text or graph readability

Risk:
- Medium

### Phase 4: Visual system polish
Goal:
- Make the whole interface feel like one product, not a collection of good components.

Changes:
- Tighten typography hierarchy and repeated component spacing.
- Standardize panel treatments, border opacity, blur strength, and button emphasis.
- Replace any remaining “default utility look” with a stronger visual language.
- Align iconography and CTA weight across controls.

Suggested UI work:
- Normalize shared panel/button styles in [index.css](/C:/Users/monro/Codex/WikiWebMap/src/index.css)
- Unify the title/search/header feel in [SearchOverlay.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/SearchOverlay.tsx)
- Harmonize floating surfaces across [GraphControls.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/GraphControls.tsx), [SearchStatusOverlay.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/SearchStatusOverlay.tsx), and [ConnectionStatusBar.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/ConnectionStatusBar.tsx)

Risk:
- Low to medium

### Phase 5: Trust and product finish
Goal:
- Make the app feel release-grade to a new visitor.

Changes:
- Add slightly better product framing and explanation of what makes the map useful.
- Improve brand consistency in copy and headings.
- Make diagnostics/logging feel intentionally “advanced mode” instead of accidental.
- Add subtle success states when major actions complete.

Suggested UI work:
- Better product framing in [README.md](/C:/Users/monro/Codex/WikiWebMap/README.md) and the app header
- Stronger loading, success, and empty-state language
- Cleaner affordances for diagnostics access

Risk:
- Low

## High-impact UX tasks

### Top 5 to do next
1. Add a “root spread” assist in [GraphManager.ts](/C:/Users/monro/Codex/WikiWebMap/src/GraphManager.ts) so major topics land in cleaner perimeter positions before the user drags them
2. Convert connection context into a more deliberate mobile/desktop drawer pattern in [ConnectionStatusBar.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/ConnectionStatusBar.tsx)
3. Add weighted link styling and legend language so strong/shared-topic bridges read immediately in [GraphManager.ts](/C:/Users/monro/Codex/WikiWebMap/src/GraphManager.ts) and [GraphControls.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/GraphControls.tsx)
4. Polish the node details sheet in [NodeDetailsPanel.tsx](/C:/Users/monro/Codex/WikiWebMap/src/components/NodeDetailsPanel.tsx)
5. Add motion rules and shared transitions in [index.css](/C:/Users/monro/Codex/WikiWebMap/src/index.css)

## Safe implementation order

1. Copy and hierarchy improvements
2. Mobile sheet/drawer layout cleanup
3. Shared motion tokens and reduced-motion handling
4. Path-result visual effects
5. Larger brand/style polish

This order keeps the highest-value improvements low-risk at the start.

## Suggested success criteria

- A new user can understand what to do in under 10 seconds.
- Mobile users can complete a topic search and a path search without confusion.
- Panels no longer feel crowded or overlapping.
- Motion makes state changes clearer instead of noisier.
- The app feels more premium without slowing down the graph.

## Recommended branch strategy

- Ship UX copy and hierarchy changes in one branch.
- Ship mobile panel/layout polish in a separate branch.
- Ship effects/motion work in a separate branch after the layout stabilizes.
- Keep `GraphManager.ts` effect changes isolated from broader refactors.
