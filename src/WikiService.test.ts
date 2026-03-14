import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WikiService } from './WikiService';

const wikiServiceInternals = WikiService as unknown as {
  cache: Map<string, unknown>;
  summaryCache: Map<string, unknown>;
  backlinksCache: Map<string, unknown>;
  categoriesCache: Map<string, unknown>;
  linkContextCache: Map<string, unknown>;
  apiUserAgentHeader?: string;
  lastApiCallTime: number;
  rateLimitChain: Promise<void>;
  enforceRateLimit: () => Promise<void>;
  extractLinksAndBoldTitles: (html: string) => {
    links: Array<{ title: string; context?: string }>;
    boldLinkTitles: string[];
  };
};

function resetWikiServiceState() {
  wikiServiceInternals.cache = new Map();
  wikiServiceInternals.summaryCache = new Map();
  wikiServiceInternals.backlinksCache = new Map();
  wikiServiceInternals.categoriesCache = new Map();
  wikiServiceInternals.linkContextCache = new Map();
  wikiServiceInternals.apiUserAgentHeader = undefined;
  wikiServiceInternals.lastApiCallTime = 0;
  wikiServiceInternals.rateLimitChain = Promise.resolve();
}

describe('WikiService', () => {
  beforeEach(() => {
    resetWikiServiceState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('extracts deduplicated paragraph links and bold links', () => {
    const html = `
      <p>
        <strong><a title="Physics">Physics</a></strong> connects to
        <a title="Mathematics">Mathematics</a>.
        <a title="Mathematics">Mathematics</a> appears twice.
      </p>
      <p>
        <a title="Help:Contents">Help</a>
        <a title="Astronomy">Astronomy</a> is nearby.
      </p>
    `;

    const result = wikiServiceInternals.extractLinksAndBoldTitles(html);

    expect(result.links.map(link => link.title)).toEqual(['Physics', 'Mathematics', 'Astronomy']);
    expect(result.links[0].context).toContain('Physics');
    expect(result.links[1].context).toContain('Mathematics');
    expect(result.boldLinkTitles).toEqual(['Physics']);
  });

  it('reuses cached links until the link cache expires', async () => {
    vi.spyOn(wikiServiceInternals, 'enforceRateLimit').mockResolvedValue(undefined);

    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        parse: {
          text: {
            '*': '<p><a title="Mathematics">Mathematics</a> supports the graph.</p>',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await WikiService.fetchLinks('Physics');
    now += 30 * 60 * 1000;
    const second = await WikiService.fetchLinks('Physics');
    now += 61 * 60 * 1000;
    const third = await WikiService.fetchLinks('Physics');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
    expect(third).toEqual(first);
  });

  it('returns a friendly fallback summary when the API request fails', async () => {
    vi.spyOn(wikiServiceInternals, 'enforceRateLimit').mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));

    const summary = await WikiService.fetchSummary('Physics');

    expect(summary).toEqual({
      title: 'Physics',
      extract: '',
      description: undefined,
      summary: 'No summary available.',
      thumbnail: undefined,
    });
  });
});
