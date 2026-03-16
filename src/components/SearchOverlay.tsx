import React, { useEffect, useState } from 'react';
import type { SuggestedPath } from '../data/suggestedPaths';

const QUICK_START_TOPICS = ['Physics', 'Jazz', 'Mount Everest'];

const THEME_STYLES: Record<string, string> = {
    science: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100',
    technology: 'border-blue-400/25 bg-blue-400/10 text-blue-100',
    culture: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100',
    history: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    place: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    ideas: 'border-violet-400/25 bg-violet-400/10 text-violet-100',
};

const inferTheme = (path: SuggestedPath) => {
    const haystack = `${path.from} ${path.to}`.toLowerCase();

    if (/(physics|quantum|mars|moon|saturn|dna|vaccine|brain|statistics|mathematics|topology|science)/.test(haystack)) return 'science';
    if (/(python|javascript|linux|git|openai|internet|cryptography|blockchain|bitcoin|tesla|apple|microsoft|google|minecraft|video game)/.test(haystack)) return 'technology';
    if (/(jazz|hip hop|beatles|taylor swift|harry potter|lord of the rings|dune|star wars|marvel|batman|sherlock|opera|music|film|photography)/.test(haystack)) return 'culture';
    if (/(renaissance|impressionism|roman empire|french revolution|world war ii|samurai|vikings|greek mythology|norse mythology|egyptian mythology)/.test(haystack)) return 'history';
    if (/(tokyo|paris|london|new york city|machu picchu|antarctica|amazon river|great barrier reef|everest|cairo|athens|naples|italy|japan)/.test(haystack)) return 'place';
    return 'ideas';
};

const describePath = (path: SuggestedPath) => {
    if (path.note) return path.note;

    const theme = inferTheme(path);
    switch (theme) {
        case 'science':
            return 'Trace a science idea through linked concepts.';
        case 'technology':
            return 'See how technical ideas and tools connect.';
        case 'culture':
            return 'Follow a path through culture, media, and art.';
        case 'history':
            return 'Jump across people, eras, and historical movements.';
        case 'place':
            return 'Explore a place through nearby topics and landmarks.';
        default:
            return 'Start from two topics and let the graph bridge them.';
    }
};

interface SearchOverlayProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    hasGraphContent: boolean;
    isTouchDevice: boolean;
    loading: boolean;
    error: string;
    suggestions: string[];
    showSuggestions: boolean;
    setShowSuggestions: (show: boolean) => void;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onAddTopic: (topic: string) => void;
    featuredPaths: SuggestedPath[];
    onShuffleFeaturedPaths: () => void;
    onRunSuggestedPath: (from: string, to: string) => void;
    showFeaturedPaths: boolean;
    onFocusSearch: () => void;
    onBlurSearch: () => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
    searchTerm,
    setSearchTerm,
    hasGraphContent,
    isTouchDevice,
    loading,
    error,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    onSearchChange,
    onAddTopic,
    featuredPaths,
    onShuffleFeaturedPaths,
    onRunSuggestedPath,
    showFeaturedPaths,
    onFocusSearch,
    onBlurSearch,
}) => {
    const [mobilePanelExpanded, setMobilePanelExpanded] = useState(!isTouchDevice);

    useEffect(() => {
        if (!isTouchDevice) {
            setMobilePanelExpanded(true);
            return;
        }

        setMobilePanelExpanded(false);
    }, [hasGraphContent, isTouchDevice]);

    const isCollapsedMobilePanel = isTouchDevice && !mobilePanelExpanded;
    const isSeededCollapsedMobilePanel = isCollapsedMobilePanel && hasGraphContent;
    const showDiscoveryPanels = searchTerm.trim().length === 0 && (!isTouchDevice || mobilePanelExpanded);
    const mobileToggleLabel = mobilePanelExpanded
        ? 'Collapse'
        : hasGraphContent
            ? 'Expand'
            : 'Open Ideas';

    return (
        <div className="fixed top-3 left-3 right-3 sm:right-auto sm:top-6 sm:left-6 z-20 sm:w-[28rem] sm:max-w-full">
            <div className="relative max-h-[calc(100vh-1.5rem)] overflow-hidden overflow-y-auto rounded-[1.75rem] border border-slate-700/70 bg-slate-900/88 shadow-2xl backdrop-blur-xl sm:max-h-none sm:overflow-visible">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_38%),radial-gradient(circle_at_85%_20%,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,0.95))]" />
                <div className={`relative flex flex-col ${isCollapsedMobilePanel ? 'gap-2 p-3' : 'gap-3 p-4'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-2 min-w-0">
                            <div className="space-y-1">
                                <h1 className={`${isCollapsedMobilePanel ? 'text-xl' : 'text-2xl'} font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-blue-200 to-indigo-200`}>
                                    WikiWebMap
                                </h1>
                                {isSeededCollapsedMobilePanel ? null : isCollapsedMobilePanel ? (
                                    <p className="max-w-md text-xs leading-relaxed text-slate-300">
                                        {hasGraphContent
                                            ? 'Tap a topic to inspect it, or search here to add another branch.'
                                            : 'Search one topic to start, or expand the panel for quick ideas.'}
                                    </p>
                                ) : (
                                    <p className="max-w-md text-sm leading-relaxed text-slate-300">
                                        Trace how Wikipedia topics connect. Start with one idea, or jump into a curated path and watch the graph bridge the gap.
                                    </p>
                                )}
                            </div>
                        </div>
                        {isTouchDevice && (
                            <button
                                type="button"
                                onClick={() => setMobilePanelExpanded(value => !value)}
                                className="shrink-0 rounded-full border border-slate-600/70 bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-cyan-400/35 hover:bg-cyan-400/10"
                                aria-expanded={mobilePanelExpanded}
                            >
                                {mobileToggleLabel}
                            </button>
                        )}
                    </div>

                    {isSeededCollapsedMobilePanel ? (
                        <div className="relative flex items-center gap-2">
                            <label htmlFor="wiki-topic-search" className="sr-only">
                                Search a Wikipedia topic
                            </label>
                            <input
                                id="wiki-topic-search"
                                type="text"
                                value={searchTerm}
                                onChange={onSearchChange}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                    onFocusSearch();
                                }}
                                onBlur={() => {
                                    setTimeout(() => setShowSuggestions(false), 200);
                                    setTimeout(() => onBlurSearch(), 200);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && onAddTopic(searchTerm)}
                                placeholder="Add another topic..."
                                aria-label="Search a Wikipedia topic"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/15"
                            />
                            <button
                                onClick={() => onAddTopic(searchTerm)}
                                disabled={loading || !searchTerm}
                                className="shrink-0 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-lg shadow-cyan-900/30 transition-all active:scale-[0.99] hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <label htmlFor="wiki-topic-search" className="sr-only">
                                Search a Wikipedia topic
                            </label>
                            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-400">
                                <span>Explore A Topic</span>
                                <span className="text-slate-500">Press Enter to add it</span>
                            </div>
                            <input
                                id="wiki-topic-search"
                                type="text"
                                value={searchTerm}
                                onChange={onSearchChange}
                                onFocus={() => {
                                    if (suggestions.length > 0) setShowSuggestions(true);
                                    onFocusSearch();
                                }}
                                onBlur={() => {
                                    setTimeout(() => setShowSuggestions(false), 200);
                                    setTimeout(() => onBlurSearch(), 200);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && onAddTopic(searchTerm)}
                                placeholder="Search a Wikipedia topic..."
                                aria-label="Search a Wikipedia topic"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/15"
                            />
                        </div>
                    )}

                    {showDiscoveryPanels && (
                        <div className="grid gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-slate-200 panel-rise">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    Start Here
                                </div>
                                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                                    Search one topic to seed the map, then click nodes to inspect them or pick two ideas to trace a path.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/50 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                                    Quick Topics
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {QUICK_START_TOPICS.map((topic) => (
                                        <button
                                            key={topic}
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm(topic);
                                                setShowSuggestions(false);
                                                onAddTopic(topic);
                                            }}
                                            className="rounded-full border border-slate-600/70 bg-slate-900/70 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-50"
                                        >
                                            {topic}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {showFeaturedPaths && featuredPaths.length > 0 && showDiscoveryPanels && (
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3 panel-rise">
                            <div className="mb-2 flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                                        Curated Path Ideas
                                    </div>
                                    <div className="mt-1 text-sm text-slate-300">
                                        Use these when you want the app to show you an interesting bridge instead of starting from one page.
                                    </div>
                                </div>
                                <button
                                    onClick={onShuffleFeaturedPaths}
                                    className="rounded-full border border-slate-700/80 bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-cyan-200 transition hover:border-cyan-400/35 hover:bg-cyan-400/10"
                                    type="button"
                                >
                                    Shuffle
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {featuredPaths.map((p, idx) => {
                                    const theme = inferTheme(p);
                                    return (
                                        <button
                                            key={`${p.from}__${p.to}__${idx}`}
                                            onClick={() => onRunSuggestedPath(p.from, p.to)}
                                            type="button"
                                            className="group w-full rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-3 text-left transition hover:border-cyan-400/35 hover:bg-cyan-400/8"
                                            title={p.note || `${p.from} → ${p.to}`}
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${THEME_STYLES[theme]}`}>
                                                    {theme}
                                                </span>
                                                <span className="text-[11px] text-slate-500 transition group-hover:text-slate-300">
                                                    Run path
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-100">
                                                <span className="font-semibold">{p.from}</span>
                                                <span className="mx-2 text-slate-500">→</span>
                                                <span className="font-semibold">{p.to}</span>
                                            </div>
                                            <div className="mt-2 text-xs leading-relaxed text-slate-400">
                                                {describePath(p)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-hidden overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/96 shadow-2xl backdrop-blur-xl">
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    className="w-full border-b border-slate-700/60 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-800/80 last:border-0"
                                    onClick={() => {
                                        setSearchTerm(suggestion);
                                        setShowSuggestions(false);
                                        onAddTopic(suggestion);
                                    }}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}

                    {!isSeededCollapsedMobilePanel && (
                        <button
                            onClick={() => onAddTopic(searchTerm)}
                            disabled={loading || !searchTerm}
                            className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all active:scale-[0.99] hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? 'Thinking...' : 'Start Exploration'}
                        </button>
                    )}

                    {!error && searchTerm.trim().length === 0 && (!isTouchDevice || mobilePanelExpanded) && (
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-2 text-xs leading-relaxed text-slate-400">
                            {isCollapsedMobilePanel ? (
                                <>
                                    Tip: the graph is live now. Tap a topic to inspect it, or use
                                    <span className="font-semibold text-slate-200"> Select For Path </span>
                                    in the details sheet to trace between two ideas.
                                </>
                            ) : (
                                <>
                                    Tip: after the graph appears, click a topic to inspect it. To find a bridge between two topics, use
                                    <span className="font-semibold text-slate-200"> Shift+Click </span>
                                    on desktop or
                                    <span className="font-semibold text-slate-200"> Select For Path </span>
                                    in the mobile details sheet.
                                </>
                            )}
                        </div>
                    )}

                    {error && (
                        <div
                            className={`rounded-2xl border px-3 py-2 text-xs ${error.startsWith('Path found')
                                ? 'border-green-500/30 bg-green-900/20 text-green-300'
                                : 'border-red-500/30 bg-red-900/20 text-red-300'
                                }`}
                        >
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
