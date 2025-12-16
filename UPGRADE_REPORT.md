# WikiWebMap Enhancement Report
## Maximizing Connection Discovery & AI Integration Opportunities

---

## Executive Summary

WikiWebMap is a well-architected Wikipedia graph explorer that currently uses **only ~20% of available Wikipedia/Wikimedia API capabilities**. This report identifies **significant untapped data sources**, **new API endpoints**, and **AI integration opportunities** that could dramatically improve connection discovery.

**Key Findings:**
- 5 new Wikipedia API endpoints can surface hidden connections
- Wikidata integration could add structured semantic relationships
- AI embeddings can find conceptual links that don't exist as hyperlinks
- Current data (summaries, categories) is fetched but underutilized

---

## Part 1: Current State Analysis

### What You're Currently Using

| API Endpoint | Data Retrieved | Usage |
|-------------|----------------|-------|
| `action=query` | Page title resolution, redirects | ✅ Full |
| `action=parse` | HTML content (section 0) | ⚠️ Partial (only hyperlinks) |
| `action=opensearch` | Search suggestions | ✅ Full |
| `rest_v1/page/summary` | Extract, description, thumbnail | ⚠️ Partial (display only) |

### Underutilized Data Already Being Fetched

**1. Article Summary/Extract** (`fetchSummary`)
- **Current use:** Display in node details panel
- **Untapped potential:**
  - Entity extraction (names, places, concepts mentioned but not linked)
  - Keyword extraction for similarity matching
  - Description field contains categorical info ("American physicist", "Japanese video game")

**2. Link Context Sentences**
- **Current use:** Display on hover/click
- **Untapped potential:**
  - Sentiment analysis (positive/negative associations)
  - Relationship type extraction ("invented by", "located in", "founded")
  - Co-occurrence scoring (concepts mentioned together)

**3. HTML Content from Parse**
- **Current use:** Extract `<a>` tags from `<p>` elements only
- **Untapped potential:**
  - Infobox data (structured key-value pairs)
  - Section headers (topic structure)
  - Bold terms in lead (aliases/alternate names)
  - Categories (often embedded in HTML)

---

## Part 2: New Wikipedia API Endpoints to Add

### 🔗 1. Backlinks API ("What Links Here")
**Endpoint:** `action=query&list=backlinks&bltitle={TITLE}`

```
https://en.wikipedia.org/w/api.php?action=query&list=backlinks
  &bltitle=Albert_Einstein&bllimit=50&format=json&origin=*
```

**What it provides:** All pages that link TO a given article (reverse links)

**Why it matters:**
- Current system only finds outgoing links (A → B)
- Backlinks reveal incoming connections (? → A)
- High backlink count = important/central topic
- Can discover related topics the original article doesn't mention

**Connection Discovery Impact:** 🔥🔥🔥🔥🔥 (Highest)

---

### 📁 2. Categories API
**Endpoint:** `action=query&prop=categories&titles={TITLE}`

```
https://en.wikipedia.org/w/api.php?action=query&prop=categories
  &titles=Albert_Einstein&cllimit=50&format=json&origin=*
```

**What it provides:** All categories a page belongs to

**Example output for "Albert Einstein":**
- Category:1879 births
- Category:German physicists
- Category:Nobel laureates in Physics
- Category:Theory of relativity
- Category:Princeton University faculty

**Why it matters:**
- Shared categories = topical relationship
- "German physicists" connects Einstein to Heisenberg, Planck
- Enables clustering and "related topics" suggestions
- Category hierarchy reveals broader/narrower concepts

**Connection Discovery Impact:** 🔥🔥🔥🔥

---

### 👥 3. Category Members API
**Endpoint:** `action=query&list=categorymembers&cmtitle=Category:{NAME}`

```
https://en.wikipedia.org/w/api.php?action=query&list=categorymembers
  &cmtitle=Category:Nobel_laureates_in_Physics&cmlimit=50&format=json&origin=*
```

**What it provides:** All pages within a category

**Why it matters:**
- Find siblings (other members of same category)
- "Einstein is in Nobel laureates → Show me other Nobel laureates"
- Enables "Explore similar" feature
- Can weight categories by specificity (fewer members = more specific = stronger connection)

**Connection Discovery Impact:** 🔥🔥🔥🔥

---

### 📊 4. Pageviews API (Popularity/Relevance)
**Endpoint:** `rest_v1/metrics/pageviews/per-article/{project}/{access}/{agent}/{article}/{granularity}/{start}/{end}`

```
https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/
  en.wikipedia/all-access/user/Albert_Einstein/daily/20240101/20240131
```

**What it provides:** Daily/monthly view counts

**Why it matters:**
- Prioritize popular articles in pathfinding
- Filter out obscure stubs
- Weight connections by destination importance
- "Hot" topics detection

**Connection Discovery Impact:** 🔥🔥🔥

---

### 🔗 5. Wikidata Entity API (Structured Knowledge)
**Endpoint:** `https://www.wikidata.org/w/api.php?action=wbgetentities&titles={TITLE}&sites=enwiki`

```
https://www.wikidata.org/w/api.php?action=wbgetentities
  &titles=Albert_Einstein&sites=enwiki&props=claims|labels|descriptions
  &format=json&origin=*
```

**What it provides:** Structured semantic data with typed relationships

**Example claims for Albert Einstein (Q937):**
| Property | Value |
|----------|-------|
| P31 (instance of) | Human (Q5) |
| P106 (occupation) | Physicist, Professor |
| P69 (educated at) | ETH Zurich, University of Zurich |
| P108 (employer) | Princeton, Kaiser Wilhelm Institute |
| P800 (notable work) | Theory of Relativity, E=mc² |
| P26 (spouse) | Mileva Marić, Elsa Einstein |
| P27 (citizenship) | Germany, Switzerland, USA |
| P166 (award) | Nobel Prize in Physics |

**Why it matters:**
- **Typed relationships**: Not just "connected" but "spouse of", "employer of", "birthplace"
- **Bidirectional by default**: If Einstein worked at Princeton, Princeton employed Einstein
- **Cross-domain connections**: Links people to places, events, concepts
- **No hyperlink dependency**: Relationships exist even without article links

**Connection Discovery Impact:** 🔥🔥🔥🔥🔥 (Highest)

---

### 📖 6. Full Article Sections API
**Endpoint:** `action=parse&page={TITLE}&prop=sections`

```
https://en.wikipedia.org/w/api.php?action=parse&page=Albert_Einstein
  &prop=sections&format=json&origin=*
```

**What it provides:** Table of contents / section structure

**Why it matters:**
- Currently only parsing section 0 (intro)
- Later sections contain deeper connections
- Section titles indicate relationship types ("Early life", "Influences", "Legacy")
- Can selectively parse high-value sections

**Connection Discovery Impact:** 🔥🔥🔥

---

## Part 3: AI Integration Opportunities

### 🤖 Option A: Semantic Similarity via Embeddings

**Concept:** Use AI embeddings to find conceptually similar topics even without direct links.

**How it works:**
1. Generate vector embeddings for article summaries
2. Store embeddings in client-side vector index (or external service)
3. Find nearest neighbors = semantically related topics
4. Surface as "AI-suggested connections"

**Implementation Options:**

| Approach | Pros | Cons |
|----------|------|------|
| **Client-side (transformers.js)** | No API costs, privacy | Large model download, slower |
| **OpenAI Embeddings API** | Fast, high quality | Cost per request, API key needed |
| **Wikidata Embedding Project** | Free, Wikipedia-specific | Still in beta (launched Oct 2025) |
| **Pre-computed embeddings** | Instant lookup | Storage/hosting needed, stale data |

**Use Cases:**
- "Find topics similar to X" (even if no links exist)
- "Why are these connected?" (explain relationship)
- Suggest bridge topics for pathfinding
- Cluster visualization by semantic similarity

**Implementation Complexity:** Medium-High
**Value:** 🔥🔥🔥🔥🔥

---

### 🤖 Option B: Entity Extraction from Summaries

**Concept:** Use NLP/AI to extract mentioned entities that aren't hyperlinked.

**Example:**
> "Albert Einstein developed the theory of relativity, one of the two pillars of modern physics (alongside quantum mechanics)."

**Extracted entities:**
- "theory of relativity" ✅ (already linked)
- "modern physics" ❌ (not linked but relevant)
- "quantum mechanics" ✅ (already linked)

**Implementation Options:**
1. **Regex patterns** - Simple but limited ("the X of Y", proper nouns)
2. **Compromise.js** - Client-side NLP library, lightweight
3. **OpenAI/Claude API** - Best accuracy, API costs
4. **Wikipedia's own bold terms** - Lead paragraph bolds are usually key entities

**Implementation Complexity:** Low-Medium
**Value:** 🔥🔥🔥

---

### 🤖 Option C: Relationship Type Classification

**Concept:** AI classifies the TYPE of connection between nodes.

**Current state:** Links are generic ("A links to B")
**Enhanced state:** Links are typed ("A *invented* B", "A *was born in* B")

**How it works:**
1. Already have context sentences for each link
2. Pass to LLM: "Classify this relationship: '{context}'"
3. Return type: INVENTED_BY, LOCATED_IN, MEMBER_OF, etc.
4. Color-code or filter links by type

**Example:**
- Context: "Einstein developed the theory of special relativity in 1905"
- Classification: CREATED / INVENTED
- Visual: Green arrow labeled "developed"

**Implementation Complexity:** Medium
**Value:** 🔥🔥🔥🔥

---

### 🤖 Option D: AI-Powered Pathfinding Hints

**Concept:** Use AI to suggest better intermediate topics for pathfinding.

**Current problem:** BFS explores blindly, often hitting dead ends.

**AI enhancement:**
1. User wants path from "Pizza" to "Ancient Rome"
2. AI suggests: "Try exploring through Italian cuisine → Italy → Roman Empire"
3. Pathfinder prioritizes these topics in queue

**Implementation:**
- Prompt: "What Wikipedia topics would connect {A} to {B}?"
- Use response to boost priority of suggested topics
- Dramatically reduces exploration space

**Implementation Complexity:** Low
**Value:** 🔥🔥🔥🔥

---

### 🤖 Option E: Natural Language Graph Queries

**Concept:** Let users ask questions in natural language.

**Examples:**
- "Show me all scientists connected to Einstein"
- "Find the shortest path through European countries"
- "What links philosophy to mathematics?"

**Implementation:**
1. Parse query with LLM
2. Convert to graph operations (filter, pathfind, expand)
3. Execute and visualize

**Implementation Complexity:** High
**Value:** 🔥🔥🔥

---

## Part 4: Connection Scoring & Ranking

### Current Scoring (in expansion):
```javascript
score = (alreadyInGraph ? 50 : 0) + (degree * 10)
```

### Proposed Enhanced Scoring:

```javascript
score =
  // Existing factors
  (alreadyInGraph ? 50 : 0) +
  (degree * 10) +

  // New API-based factors
  (hasBacklinkToSource ? 30 : 0) +        // Bidirectional = stronger
  (sharedCategories * 15) +                // Category overlap
  (log10(pageviews) * 5) +                 // Popularity boost

  // AI-based factors (optional)
  (semanticSimilarity * 40) +              // Embedding distance
  (sameWikidataType ? 20 : 0) +            // Both are "scientists", etc.

  // Context-based factors
  (mentionedInFirstParagraph ? 10 : 0) +   // Early mention = important
  (contextSentenceLength < 100 ? 5 : 0)    // Specific mention vs. list
```

---

## Part 5: Implementation Roadmap

### Phase 1: Quick Wins (Low effort, High impact)

| Enhancement | API/Tech | Effort | Impact |
|------------|----------|--------|--------|
| Add backlinks discovery | `action=query&list=backlinks` | 2-3 hours | 🔥🔥🔥🔥🔥 |
| Fetch & display categories | `action=query&prop=categories` | 2-3 hours | 🔥🔥🔥🔥 |
| Extract bold terms from intro | Parse existing HTML | 1-2 hours | 🔥🔥 |
| Use description for clustering | Already fetched in summary | 1 hour | 🔥🔥 |

### Phase 2: Medium Effort Enhancements

| Enhancement | API/Tech | Effort | Impact |
|------------|----------|--------|--------|
| Wikidata entity integration | Wikidata API | 1-2 days | 🔥🔥🔥🔥🔥 |
| Category-based "similar topics" | `list=categorymembers` | 3-4 hours | 🔥🔥🔥🔥 |
| Pageviews for ranking | Wikimedia REST API | 2-3 hours | 🔥🔥🔥 |
| Parse more sections (not just intro) | `action=parse` with sections | 3-4 hours | 🔥🔥🔥 |

### Phase 3: AI Integration

| Enhancement | Tech | Effort | Impact |
|------------|------|--------|--------|
| Entity extraction (simple) | Regex + bold terms | 2-3 hours | 🔥🔥🔥 |
| Entity extraction (NLP) | compromise.js | 1 day | 🔥🔥🔥 |
| Semantic similarity | transformers.js / API | 2-3 days | 🔥🔥🔥🔥🔥 |
| Relationship classification | LLM API | 1-2 days | 🔥🔥🔥🔥 |
| Pathfinding hints | LLM API | 1 day | 🔥🔥🔥🔥 |

---

## Part 6: Architecture Recommendations

### New Service Structure

```
src/
  services/
    WikiService.ts        # Existing - article content & links
    WikidataService.ts    # NEW - structured entity data
    CategoryService.ts    # NEW - category operations
    BacklinkService.ts    # NEW - reverse link discovery
    PageviewService.ts    # NEW - popularity metrics
    AIService.ts          # NEW - embeddings & NLP
```

### Caching Strategy

```typescript
// Recommended cache durations
const CACHE_DURATIONS = {
  links: 60 * 60 * 1000,        // 1 hour (changes rarely)
  summary: Infinity,             // Never expires (immutable)
  categories: 24 * 60 * 60 * 1000, // 24 hours
  backlinks: 60 * 60 * 1000,    // 1 hour
  wikidata: 24 * 60 * 60 * 1000, // 24 hours (structured, stable)
  pageviews: 60 * 60 * 1000,    // 1 hour (changes frequently)
  embeddings: Infinity,          // Computed once, reuse forever
};
```

### New Data Types

```typescript
interface EnhancedNode extends Node {
  // Existing
  id: string;
  title: string;

  // New from Categories API
  categories?: string[];

  // New from Wikidata
  wikidataId?: string;           // e.g., "Q937"
  instanceOf?: string[];         // e.g., ["human", "physicist"]
  properties?: WikidataProperty[];

  // New from Pageviews
  popularity?: number;           // Monthly views

  // New from AI
  embedding?: number[];          // Vector representation
  extractedEntities?: string[];  // NLP-extracted mentions
}

interface EnhancedLink extends Link {
  // Existing
  source: string;
  target: string;
  context?: string;

  // New
  relationshipType?: string;     // "invented", "born_in", etc.
  strength?: number;             // Computed connection strength
  isBidirectional?: boolean;     // Has backlink?
  sharedCategories?: string[];   // Common categories
}
```

---

## Part 7: UI/UX Enhancements for New Data

### Connection Type Filters
```
[x] Direct Links
[x] Backlinks
[ ] Category Siblings
[ ] Wikidata Relations
[ ] AI Suggestions
```

### Enhanced Node Details Panel
```
┌─────────────────────────────────────┐
│ 🖼️ Albert Einstein                  │
│ German-born theoretical physicist    │
├─────────────────────────────────────┤
│ 📊 Views: 2.3M/month (Top 0.1%)     │
├─────────────────────────────────────┤
│ 🏷️ Categories:                       │
│   • German physicists               │
│   • Nobel laureates in Physics      │
│   • Relativity theorists            │
├─────────────────────────────────────┤
│ 🔗 Wikidata Relations:              │
│   • Spouse: Mileva Marić            │
│   • Employer: Princeton University   │
│   • Notable work: E=mc²             │
├─────────────────────────────────────┤
│ 🤖 AI Suggestions:                  │
│   • Niels Bohr (95% similar)        │
│   • Max Planck (92% similar)        │
└─────────────────────────────────────┘
```

### Link Visualization Enhancements
- **Line thickness** = connection strength
- **Line color** = relationship type (blue=person, green=place, etc.)
- **Arrows** = directionality (→ outlink, ← backlink, ↔ bidirectional)
- **Dashed lines** = AI-suggested (not actual Wikipedia links)

---

## Part 8: Cost & Performance Considerations

### API Rate Limits
| API | Rate Limit | Current Usage | With Enhancements |
|-----|------------|---------------|-------------------|
| Wikipedia | ~200 req/sec (be nice: 10/sec) | ~6-7/sec | ~10-15/sec |
| Wikidata | Same infrastructure | 0/sec | ~2-3/sec |
| Wikimedia REST | 200 req/sec | 0/sec | ~1-2/sec |

**Recommendation:** Batch requests where possible, expand caching.

### AI API Costs (if using external)
| Service | Cost | Usage Estimate |
|---------|------|----------------|
| OpenAI Embeddings | $0.0001/1K tokens | ~$0.01 per 100 nodes |
| Claude/GPT Classification | $0.01-0.03/1K tokens | ~$0.10 per 100 classifications |

**Recommendation:** Start with client-side options, add API as premium feature.

### Bundle Size Impact
| Addition | Size Impact |
|----------|-------------|
| compromise.js (NLP) | +200KB |
| transformers.js | +5-50MB (model dependent) |
| Additional API code | +10-20KB |

**Recommendation:** Lazy-load AI features, code-split aggressively.

---

## Part 9: Recommended Starting Point

### If I were to pick ONE enhancement to start with:

## 🏆 Backlinks + Wikidata Combo

**Why:**
1. **Backlinks** immediately doubles connection discovery (incoming + outgoing)
2. **Wikidata** provides structured, typed relationships that Wikipedia links don't capture
3. Both are **free APIs** with no AI costs
4. Together they transform "links between articles" into a true **knowledge graph**

**Implementation sketch:**

```typescript
// New method in WikiService.ts
static async fetchBacklinks(title: string): Promise<string[]> {
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=backlinks` +
    `&bltitle=${encodeURIComponent(title)}&bllimit=20&format=json&origin=*`
  );
  const data = await response.json();
  return data.query.backlinks.map((bl: any) => bl.title);
}

// New WikidataService.ts
static async fetchEntityRelations(title: string): Promise<WikidataRelation[]> {
  const response = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities` +
    `&titles=${encodeURIComponent(title)}&sites=enwiki&props=claims` +
    `&format=json&origin=*`
  );
  // Parse claims into typed relationships...
}
```

---

## Summary & Next Steps

### What You're Missing (Priority Order)

1. **🔴 Critical:** Backlinks - doubles your connection data instantly
2. **🔴 Critical:** Wikidata - adds typed semantic relationships
3. **🟡 High:** Categories - enables clustering and similarity
4. **🟡 High:** AI embeddings - finds conceptual connections
5. **🟢 Medium:** Pageviews - improves ranking and filtering
6. **🟢 Medium:** Entity extraction - surfaces hidden mentions
7. **🔵 Nice-to-have:** Relationship classification - enriches link meaning

### Quick Action Items

- [ ] Add `fetchBacklinks()` to WikiService (~30 min)
- [ ] Create WikidataService with `fetchEntity()` (~2 hours)
- [ ] Add categories to node metadata (~1 hour)
- [ ] Display backlink count in node details (~30 min)
- [ ] Add "connection type" filter to UI (~1 hour)

---

## Appendix: API Reference Quick Links

- [MediaWiki API Documentation](https://www.mediawiki.org/wiki/API:Main_page)
- [Wikidata Query Service](https://query.wikidata.org/)
- [Wikimedia REST API](https://wikimedia.org/api/rest_v1/)
- [Wikidata Embedding Project](https://www.wikidata.org/wiki/Wikidata:Embedding_Project)
- [transformers.js (client-side ML)](https://huggingface.co/docs/transformers.js)

---

*Report generated for WikiWebMap enhancement planning*
*Date: December 2024*
