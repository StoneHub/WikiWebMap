



export interface LinkWithContext {
    title: string;
    context?: string;
}

interface CacheItem {
    links: LinkWithContext[]; // Updated to store context
    timestamp: number;
}

export interface SummaryData {
    title: string;
    extract: string;
    description: string;
    thumbnail: string;
    summary: string;
}

export class WikiService {
    private static cache: Map<string, CacheItem> = new Map();
    private static summaryCache: Map<string, SummaryData> = new Map();
    private static apiUserAgentHeader: string | undefined;

    static setApiUserAgent(value: string | undefined) {
        const next = value?.trim();
        this.apiUserAgentHeader = next ? next : undefined;
    }

    private static getRequestHeaders(): HeadersInit | undefined {
        return this.apiUserAgentHeader ? { 'Api-User-Agent': this.apiUserAgentHeader } : undefined;
    }

    static async resolveTitle(query: string): Promise<string> {
        try {
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

            const links = this.extractLinksWithContext(htmlContent);

            // Update cache
            this.cache.set(title, {
                links: links,
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
    private static extractLinksWithContext(html: string): LinkWithContext[] {
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

        return results;
    }

    static getLinksFromCache(title: string): LinkWithContext[] | undefined {
        return this.cache.get(title)?.links;
    }

    static getCachedNodes(): string[] {
        return Array.from(this.cache.keys());
    }

    static async search(term: string): Promise<string[]> {
        try {
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

    static async fetchSummary(title: string): Promise<{ summary: string; thumbnail?: string }> {
        // Check cache
        if (this.summaryCache.has(title)) {
            return this.summaryCache.get(title)!;
        }

        try {
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
            return { summary: 'No summary available.', thumbnail: undefined };
        }
    }
}
