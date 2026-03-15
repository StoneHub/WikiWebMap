# AI API And MCP Plan

## Recommendation

Build this in two layers:
1. A read-only HTTP/API layer for the core WikiWebMap operations
2. An MCP server that wraps that API for agent/tool use

Do not make the MCP server depend directly on the browser UI, D3 state, or DOM-driven app behavior.

## Why API-first is the safer architecture

- The current app is a client-rendered graph explorer, not a stable service boundary.
- AI clients need deterministic JSON contracts, not browser-side state.
- Server-side caching and rate limiting are important before exposing topic/path queries to automated agents.
- MCP should be a thin adapter, not the place where domain logic lives.

## Proposed first API surface

### `resolve_topic`
Input:
- `title`

Output:
- `requestedTitle`
- `canonicalTitle`
- `found`

### `get_topic`
Input:
- `title`

Output:
- `title`
- `summary`
- `description`
- `categories`
- `thumbnail`
- `backlinkCount` optional

### `get_neighbors`
Input:
- `title`
- `direction`: `outgoing` | `incoming` | `both`
- `limit`
- `includeContext`

Output:
- `title`
- `canonicalTitle`
- `neighbors`: array of `{ source, target, direction, type, contextSnippet }`

### `find_paths`
Input:
- `from`
- `to`
- `maxDepth`
- `maxPaths`

Output:
- `from`
- `to`
- `canonicalFrom`
- `canonicalTo`
- `paths`
- `searchedDepth`
- `truncated`

### `expand_graph`
Input:
- `seeds`
- `depth`
- `limitPerNode`

Output:
- `nodes`
- `edges`
- `truncated`

## Response rules

- Return bounded JSON only.
- Normalize and canonicalize Wikipedia titles.
- Limit context/snippet length.
- Cap path counts and traversal breadth.
- Never return raw parsed HTML.
- Treat Wikipedia responses as untrusted external input.

## Suggested backend shape

Recommended deployment target:
- A small Node service deployed separately from the static frontend.
- Keep Firebase Hosting for the SPA and add the API as a separate service endpoint or rewrite target.

Suggested modules:
- `titleResolver`
- `wikiClient`
- `wikiCache`
- `pathfinder`
- `responseNormalizer`
- `rateLimiter`

## MCP layer

The MCP server should expose tools mapped to the API surface:
- `resolve_topic`
- `get_topic`
- `get_neighbors`
- `find_paths`
- `expand_graph`

Optional resources later:
- Topic summaries
- Cached path results
- Featured path sets

## Rollout plan

### Step 1: Contract doc
- Finalize request/response contracts and limits.

### Step 2: Internal API prototype
- Implement read-only endpoints with tests and caching.

### Step 3: Agent usability pass
- Add tool descriptions, example inputs, and friendly error shapes.

### Step 4: MCP server
- Wrap the stable API instead of re-implementing logic.

### Step 5: Production hardening
- Add rate limits, logs, request IDs, and abuse controls before opening access more broadly.

## Non-goals for the first version

- No write operations
- No auth/user accounts unless exposure requires it
- No D3/browser-driven tool execution
- No broad frontend rewrite as part of the API launch
