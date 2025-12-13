
interface WikiSummary {
    summary: string;
    thumbnail: string | null;
}

export class WikiService {
    private static cache: Record<string, string[]> = {};
    private static summaryCache: Record<string, WikiSummary> = {};

    /**
     * Fetch links from the intro section of a Wikipedia page.
     * Uses simple caching to avoid repeated requests.
     */
    static async fetchLinks(title: string): Promise<string[]> {
        if (this.cache[title]) {
            return this.cache[title];
        }

        try {
            // Use parse API with section=0 to get only intro links (most relevant)
            const response = await fetch(
                `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
                    title
                )}&prop=links&section=0&format=json&origin=*&redirects=1`
            );

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.parse || !data.parse.links) {
                console.warn(`[WikiService] Page "${title}" has no parseable content`);
                this.cache[title] = [];
                return [];
            }

            // Blacklist of terms to ignore
            const BLACKLIST = [
                'ISSN', 'ISBN', 'PMID', 'Doi', 'S2CID', 'JSTOR', 'OCLC', 'LCCN',
                'Wayback Machine', 'Help:', 'Category:', 'Portal:', 'Talk:', 'Special:',
                'Wikipedia:', 'Template:', 'File:', 'Main Page', 'Identifier', 'Bibcode',
                'ArXiv', 'ASIN'
            ];

            // Regex for years (1000-2099), decades (1990s), and dates
            const DATE_REGEX = /^(\d{4}(s)?|January|February|March|April|May|June|July|August|September|October|November|December)\b/i;

            const links = data.parse.links
                .filter((link: any) => link.ns === 0) // Articles only
                .map((link: any) => link['*'])
                .filter((title: string) => {
                    // Filter out blacklisted terms
                    if (BLACKLIST.some(term => title.includes(term))) return false;
                    // Filter out dates/years
                    if (DATE_REGEX.test(title)) return false;
                    // Filter out single characters or very short junk
                    if (title.length < 2) return false;
                    return true;
                });

            // Shuffle links (Fisher-Yates) to avoid alphabetical bias
            for (let i = links.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [links[i], links[j]] = [links[j], links[i]];
            }

            // Take top 50 unique after shuffle
            const uniqueLinks = Array.from(new Set(links)).slice(0, 50) as string[];

            this.cache[title] = uniqueLinks;
            return uniqueLinks;
        } catch (err: any) {
            console.error('Fetch error:', err);
            // Don't throw if possible, just return empty to keep app alive?
            // But caller might want to know. Let's rethrow for now.
            throw new Error(`Failed to fetch links: ${err.message}`);
        }
    }

    /**
     * Fetch summary and thumbnail from Wikipedia REST API.
     */
    static async fetchSummary(title: string): Promise<WikiSummary> {
        if (this.summaryCache[title]) {
            return this.summaryCache[title];
        }

        try {
            const response = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                return { summary: 'Summary not available', thumbnail: null };
            }

            const data = await response.json();

            const result = {
                summary: data.extract || 'No summary available',
                thumbnail: data.thumbnail?.source || null
            };

            this.summaryCache[title] = result;
            return result;
        } catch (err) {
            console.error('Summary fetch error:', err);
            return { summary: 'Failed to load summary', thumbnail: null };
        }
    }

    /**
   * Pre-fetch multiple pages if possible, or just helper for parallel.
   */
    static async fetchSeveral(titles: string[]): Promise<Record<string, string[]>> {
        const results: Record<string, string[]> = {};
        await Promise.all(
            titles.map(async (t) => {
                try {
                    results[t] = await this.fetchLinks(t);
                } catch {
                    results[t] = [];
                }
            })
        );
        return results;
    }

    /**
     * Get list of all nodes currently in cache
     */
    static getCachedNodes(): string[] {
        return Object.keys(this.cache);
    }

    /**
     * Get links for a node from cache without fetching
     */
    static getLinksFromCache(title: string): string[] | undefined {
        return this.cache[title];
    }
}
