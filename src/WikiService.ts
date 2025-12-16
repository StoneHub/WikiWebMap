



export interface LinkWithContext {
    title: string;
    context?: string;
}

interface CacheItem {
    links: LinkWithContext[]; // Updated to store context
    boldLinkTitles?: string[];
    timestamp: number;
}

interface BacklinkCacheItem {
    backlinks: string[];
    timestamp: number;
}

interface CategoriesCacheItem {
    categories: string[];
    timestamp: number;
}

export interface SummaryData {
    title: string;
    extract: string;
    description?: string;
    thumbnail?: string;
    summary: string;
}

export class WikiService {
    private static cache: Map<string, CacheItem> = new Map();
    private static summaryCache: Map<string, SummaryData> = new Map();
    private static backlinksCache: Map<string, BacklinkCacheItem> = new Map();
    private static categoriesCache: Map<string, CategoriesCacheItem> = new Map();
    private static linkContextCache: Map<string, { context?: string; timestamp: number }> = new Map();
    private static apiUserAgentHeader: string | undefined;

    // Rate limiting: minimum delay between API calls (milliseconds)
    private static readonly API_CALL_DELAY = 150; // 150ms = ~6-7 requests/second max
    private static lastApiCallTime = 0;
    private static rateLimitChain: Promise<void> = Promise.resolve();

    static setApiUserAgent(value: string | undefined) {
        const next = value?.trim();
        this.apiUserAgentHeader = next ? next : undefined;
    }

    private static getRequestHeaders(): HeadersInit | undefined {
        return this.apiUserAgentHeader ? { 'Api-User-Agent': this.apiUserAgentHeader } : undefined;
    }

    /**
     * Rate limiting helper: Ensures minimum delay between API calls
     * This prevents aggressive bot-like behavior and respects Wikipedia's servers
     */
    private static async enforceRateLimit(): Promise<void> {
        const next = this.rateLimitChain
            .catch(() => { /* keep chain alive */ })
            .then(async () => {
                const now = Date.now();
                const timeSinceLastCall = now - this.lastApiCallTime;

                if (timeSinceLastCall < this.API_CALL_DELAY) {
                    const delayNeeded = this.API_CALL_DELAY - timeSinceLastCall;
                    await new Promise(resolve => setTimeout(resolve, delayNeeded));
                }

                this.lastApiCallTime = Date.now();
            });
        this.rateLimitChain = next;
        await next;
    }

    static async resolveTitle(query: string): Promise<string> {
        try {
            await this.enforceRateLimit();
            const response = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&redirects=1&format=json&origin=*`,
                { headers: this.getRequestHeaders() }
            );
            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];

            if (pageId === '-1') {
                throw new Error(`Page "${query}" not found on Wikipedia.`);
            }

            return pages[pageId].title;
        } catch (err) {
            console.warn(`[WikiService] Could not resolve "${query}", using original.`, err);
            return query;
        }
    }

    static async fetchLinks(title: string): Promise<LinkWithContext[]> {
        // Check cache
        if (this.cache.has(title)) {
            const item = this.cache.get(title)!;
            if (Date.now() - item.timestamp < 1000 * 60 * 60) { // 1 hour cache
                return item.links;
            }
        }

        try {
            await this.enforceRateLimit();
            // Use parse action to get text content for context extraction
            const response = await fetch(
                `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
                    title
                )}&prop=text&section=0&format=json&origin=*&redirects=1`
                ,
                { headers: this.getRequestHeaders() }
            );

            if (!response.ok) throw new Error('Failed to fetch from Wikipedia');

            const data = await response.json();

            if (data.error) throw new Error(data.error.info);

            const htmlContent = data.parse?.text['*'];

            if (!htmlContent) return []; // Should not happen if page exists

            const { links, boldLinkTitles } = this.extractLinksAndBoldTitles(htmlContent);

            // Update cache
            this.cache.set(title, {
                links: links,
                boldLinkTitles,
                timestamp: Date.now()
            });

            return links;

        } catch (error) {
            console.error('Wiki API Error:', error);
            // Fallback or rethrow?
            return [];
        }
    }

    /**
     * Parse HTML to find links and extract their surrounding sentence/context.
     */
    private static extractLinksAndBoldTitles(html: string): { links: LinkWithContext[]; boldLinkTitles: string[] } {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // We want to avoid links in infoboxes, navboxes, references, etc. if possible
        // But standard 'parse' output is messy. Let's trust standard paragraphs <p> mostly.
        const paragraphs = doc.querySelectorAll('p');
        const results: LinkWithContext[] = [];
        const seen = new Set<string>();

        paragraphs.forEach(p => {
            // Get all links in this paragraph
            const anchors = p.querySelectorAll('a');
            anchors.forEach(a => {
                const linkTitle = a.getAttribute('title');
                const linkText = a.textContent;

                // Filter logic
                if (!linkTitle || !linkText) return;
                if (linkTitle.startsWith('Help:') || linkTitle.startsWith('File:') || linkTitle.startsWith('Wikipedia:') || linkTitle.startsWith('Edit section')) return;

                const cleanTitle = linkTitle;

                if (seen.has(cleanTitle)) return;
                // Limit check? No, fetchLinks can handle limits or we slice later. 
                // But for graph performance let's keep it reasonable per page? 
                // Let's cap at 50 per page here to avoid massive processing.
                if (seen.size >= 50) return;

                // Extract Context: The sentence containing this link.
                // Simple regex split on sentences?
                const textContent = p.textContent || '';

                // Find sentence: look for [.?!] followed by space or end, containing the link text
                // This is tricky. Simplified: take a window around the link.
                // Or just split by sentences and find the one with the link.

                const sentences = textContent.match(/[^.!?]+[.!?]+/g) || [textContent];
                const contextSentence = sentences.find(s => s.includes(linkText))?.trim() || p.textContent?.substring(0, 150) + '...';

                results.push({
                    title: cleanTitle,
                    context: contextSentence
                });
                seen.add(cleanTitle);
            });
        });

        const boldSet = new Set<string>();
        doc.querySelectorAll('p b a[title], p strong a[title]').forEach(a => {
            const linkTitle = a.getAttribute('title');
            if (!linkTitle) return;
            if (linkTitle.startsWith('Help:') || linkTitle.startsWith('File:') || linkTitle.startsWith('Wikipedia:') || linkTitle.startsWith('Edit section')) return;
            boldSet.add(linkTitle);
        });

        return { links: results, boldLinkTitles: Array.from(boldSet) };
    }

    static getLinksFromCache(title: string): LinkWithContext[] | undefined {
        return this.cache.get(title)?.links;
    }

    static getBoldLinkTitlesFromCache(title: string): string[] | undefined {
        return this.cache.get(title)?.boldLinkTitles;
    }

    static getCachedNodes(): string[] {
        return Array.from(this.cache.keys());
    }

    static async fetchBacklinks(title: string, limit: number = 20): Promise<string[]> {
        const cached = this.backlinksCache.get(title);
        if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60) {
            return cached.backlinks;
        }

        try {
            await this.enforceRateLimit();
            const response = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&list=backlinks` +
                `&bltitle=${encodeURIComponent(title)}&bllimit=${limit}&blnamespace=0&format=json&origin=*&redirects=1`,
                { headers: this.getRequestHeaders() }
            );
            if (!response.ok) throw new Error('Failed to fetch backlinks');
            const data = await response.json();
            const backlinks = (data?.query?.backlinks || []).map((bl: any) => bl.title).filter(Boolean);
            this.backlinksCache.set(title, { backlinks, timestamp: Date.now() });
            return backlinks;
        } catch (error) {
            console.error('Backlinks API Error:', error);
            return [];
        }
    }

    static async fetchCategories(title: string, limit: number = 50): Promise<string[]> {
        const cached = this.categoriesCache.get(title);
        if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60 * 24) {
            return cached.categories;
        }

        try {
            await this.enforceRateLimit();
            const response = await fetch(
                `https://en.wikipedia.org/w/api.php?action=query&prop=categories` +
                `&titles=${encodeURIComponent(title)}&cllimit=${limit}&clshow=!hidden&format=json&origin=*&redirects=1`,
                { headers: this.getRequestHeaders() }
            );
            if (!response.ok) throw new Error('Failed to fetch categories');
            const data = await response.json();
            const pages = data?.query?.pages || {};
            const pageId = Object.keys(pages)[0];
            const page = pageId ? pages[pageId] : undefined;
            const categories = (page?.categories || [])
                .map((c: any) => (typeof c?.title === 'string' ? c.title : ''))
                .filter(Boolean)
                .map((t: string) => t.replace(/^Category:/, ''));

            this.categoriesCache.set(title, { categories, timestamp: Date.now() });
            return categories;
        } catch (error) {
            console.error('Categories API Error:', error);
            return [];
        }
    }

    static async fetchLinkContext(sourceTitle: string, targetTitle: string): Promise<string | undefined> {
        const cacheKey = `${sourceTitle}|||${targetTitle}`;
        const cached = this.linkContextCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60) {
            return cached.context;
        }

        const tryFetch = async (section?: number) => {
            await this.enforceRateLimit();
            const sectionParam = typeof section === 'number' ? `&section=${section}` : '';
            const response = await fetch(
                `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(sourceTitle)}` +
                `&prop=text${sectionParam}&format=json&origin=*&redirects=1`,
                { headers: this.getRequestHeaders() }
            );
            if (!response.ok) throw new Error('Failed to fetch article HTML');
            const data = await response.json();
            const htmlContent = data.parse?.text?.['*'];
            if (!htmlContent) return undefined;
            return this.extractContextForSpecificLink(htmlContent, targetTitle);
        };

        try {
            // Try lead section first (fast + usually best explanation).
            const lead = await tryFetch(0);
            if (lead) {
                this.linkContextCache.set(cacheKey, { context: lead, timestamp: Date.now() });
                return lead;
            }

            // Fallback: scan full page (can be large, but this is only on-demand from a click).
            const full = await tryFetch(undefined);
            this.linkContextCache.set(cacheKey, { context: full, timestamp: Date.now() });
            return full;
        } catch (error) {
            console.error('Link context fetch error:', error);
            this.linkContextCache.set(cacheKey, { context: undefined, timestamp: Date.now() });
            return undefined;
        }
    }

    private static extractContextForSpecificLink(html: string, targetTitle: string): string | undefined {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const paragraphs = Array.from(doc.querySelectorAll('p'));
        for (const p of paragraphs.slice(0, 30)) {
            const anchors = Array.from(p.querySelectorAll('a[title]'));
            const match = anchors.find(a => a.getAttribute('title') === targetTitle);
            if (!match) continue;
            const linkText = match.textContent?.trim() || targetTitle;
            const textContent = p.textContent || '';
            const sentences = textContent.match(/[^.!?]+[.!?]+/g) || [textContent];
            const raw = sentences.find(s => s.includes(linkText))?.trim() || textContent.trim();
            const cleaned = raw.replace(/\s+/g, ' ').trim();
            if (!cleaned) return undefined;
            return cleaned.length > 260 ? `${cleaned.slice(0, 257)}...` : cleaned;
        }

        return undefined;
    }

    static async search(term: string): Promise<string[]> {
        try {
            await this.enforceRateLimit();
            const response = await fetch(
                `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
                    term
                )}&limit=5&namespace=0&format=json&origin=*`
                ,
                { headers: this.getRequestHeaders() }
            );
            const data = await response.json();
            return data[1];
        } catch (error) {
            console.error('Search Error:', error);
            return [];
        }
    }

    static async fetchSummary(title: string): Promise<SummaryData> {
        // Check cache
        if (this.summaryCache.has(title)) {
            return this.summaryCache.get(title)!;
        }

        try {
            await this.enforceRateLimit();
            const response = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
                { headers: this.getRequestHeaders() }
            );
            if (!response.ok) throw new Error('Failed to fetch summary');
            const data = await response.json();

            const result = {
                title: data.title,
                extract: data.extract,
                description: data.description,
                summary: data.extract,
                thumbnail: data.thumbnail?.source
            };

            this.summaryCache.set(title, result);
            return result;
        } catch (err) {
            console.error(err);
            return { title, extract: '', description: undefined, summary: 'No summary available.', thumbnail: undefined };
        }
    }
}
