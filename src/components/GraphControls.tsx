import React, { useEffect, useState } from 'react';
import { type LayoutMode } from '../features/layout/layoutConfig';

const PROJECT_GITHUB_URL = 'https://github.com/StoneHub/WikiWebMap';
const PERSONAL_SITE_URL = 'https://monroes.tech';

interface GraphControlsProps {
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
    layoutMode: LayoutMode;
    setLayoutMode: (mode: LayoutMode) => void;
    nodeSpacing: number;
    setNodeSpacing: (spacing: number) => void;
    treeSpacing: number;
    setTreeSpacing: (spacing: number) => void;
    branchSpread: number;
    setBranchSpread: (spread: number) => void;
    showCrossLinks: boolean;
    setShowCrossLinks: (value: boolean) => void;
    recursionDepth: number;
    setRecursionDepth: (depth: number) => void;
    nodeSizeScale: number;
    setNodeSizeScale: (scale: number) => void;
    includeBacklinks: boolean;
    setIncludeBacklinks: (value: boolean) => void;
    apiContactEmail: string;
    setApiContactEmail: (email: string) => void;
    nodeCount: number;
    linkCount: number;
    canPruneLeaves: boolean;
    canDeleteSelection: boolean;
    isTouchDevice: boolean;
    mobileDockMode?: 'none' | 'bar' | 'sheet';
    onPruneLeaves: () => void;
    onDeleteSelection: () => void;
    onOpenLogs?: () => void;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
    showSettings,
    setShowSettings,
    layoutMode,
    setLayoutMode,
    nodeSpacing,
    setNodeSpacing,
    treeSpacing,
    setTreeSpacing,
    branchSpread,
    setBranchSpread,
    showCrossLinks,
    setShowCrossLinks,
    recursionDepth,
    setRecursionDepth,
    nodeSizeScale,
    setNodeSizeScale,
    includeBacklinks,
    setIncludeBacklinks,
    apiContactEmail,
    setApiContactEmail,
    nodeCount,
    linkCount,
    canPruneLeaves,
    canDeleteSelection,
    isTouchDevice,
    mobileDockMode = 'none',
    onPruneLeaves,
    onDeleteSelection,
    onOpenLogs,
}) => {
    const [showLegend, setShowLegend] = useState(false);
    const [desktopPanelSidecarLeft, setDesktopPanelSidecarLeft] = useState<number | null>(null);
    const isGuidedMap = layoutMode === 'structured';
    const mobileSheetClassName =
        'fixed inset-x-3 bottom-20 pointer-events-auto rounded-[1.75rem] border border-slate-700/70 bg-slate-900/94 p-4 shadow-[0_22px_60px_rgba(2,6,23,0.6)] backdrop-blur-xl max-h-[60vh] overflow-y-auto';
    const desktopPanelClassName =
        'pointer-events-auto w-80 max-w-[calc(100vw-3rem)] overflow-y-auto rounded-2xl border border-gray-700/60 bg-gray-800/92 p-4 shadow-2xl backdrop-blur-md';
    const desktopPanelStyle = {
        maxHeight: 'clamp(18rem, calc(100vh - 24rem), 30rem)',
    } as const;
    const desktopSidecarPanelStyle = {
        maxHeight: 'calc(100vh - 3rem)',
    } as const;

    const toggleSettings = () => {
        const next = !showSettings;
        setShowSettings(next);
        if (next) setShowLegend(false);
    };

    const toggleLegend = () => {
        const next = !showLegend;
        setShowLegend(next);
        if (next) setShowSettings(false);
    };

    useEffect(() => {
        if (isTouchDevice || (!showLegend && !showSettings) || typeof window === 'undefined') {
            setDesktopPanelSidecarLeft(null);
            return;
        }

        const updateDesktopPanelPosition = () => {
            const searchPanel = document.querySelector('div.fixed.top-3.left-3.right-3');
            const panelWidth = 320;
            const viewportPadding = 24;
            const gap = 24;
            const searchRect = searchPanel?.getBoundingClientRect();

            if (searchRect && searchRect.right + gap + panelWidth <= window.innerWidth - viewportPadding) {
                setDesktopPanelSidecarLeft(searchRect.right + gap);
                return;
            }

            setDesktopPanelSidecarLeft(null);
        };

        updateDesktopPanelPosition();
        window.addEventListener('resize', updateDesktopPanelPosition);
        return () => window.removeEventListener('resize', updateDesktopPanelPosition);
    }, [isTouchDevice, showLegend, showSettings]);

    const renderLegendContent = () => (
        <>
            <div className="space-y-2 text-xs text-gray-200">
                <div className="flex items-center justify-between">
                    <span className="text-gray-300">Primary branches</span>
                    <svg width="84" height="12" className="opacity-90">
                        <line x1="2" y1="6" x2="82" y2="6" stroke="#7dd3fc" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-300">Cross-tree links</span>
                    <svg width="84" height="12" className="opacity-90">
                        <line x1="2" y1="6" x2="82" y2="6" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
                    </svg>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-300">Guided branches</span>
                    <svg width="84" height="12" className="opacity-90">
                        <line x1="2" y1="6" x2="82" y2="6" stroke="#a3a3a3" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-300">Backlinks</span>
                    <svg width="84" height="12" className="opacity-90">
                        <line x1="2" y1="6" x2="82" y2="6" stroke="#ffb020" strokeWidth="3" strokeDasharray="6 10" />
                    </svg>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-300">Path result</span>
                    <svg width="84" height="12" className="opacity-90">
                        <defs>
                            <linearGradient id="legend-grad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.95" />
                            </linearGradient>
                        </defs>
                        <line x1="2" y1="6" x2="82" y2="6" stroke="url(#legend-grad)" strokeWidth="4" />
                    </svg>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700/50 text-[11px] text-gray-300 leading-relaxed">
                Guided mode keeps the draggable node map, but adds stronger branch anchors and quieter bridge links so the graph stays readable while you rearrange it. Wider, brighter links hint at tighter local overlap between topics.
            </div>
        </>
    );

    const renderSettingsContent = () => (
        <>
            <div className="mb-3 text-[11px] text-gray-300 flex gap-4">
                <span>
                    Nodes: <span className="text-white font-semibold">{nodeCount}</span>
                </span>
                <span>
                    Connections: <span className="text-white font-semibold">{linkCount}</span>
                </span>
            </div>
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>Layout Mode</span>
                        <span className="uppercase tracking-[0.18em] text-[10px] text-cyan-200">{layoutMode}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setLayoutMode('forest')}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${layoutMode === 'forest'
                                ? 'border-cyan-400/40 bg-cyan-400/12 text-cyan-100'
                                : 'border-slate-700/70 bg-slate-900/50 text-slate-300 hover:border-cyan-400/20'
                                }`}
                        >
                            Forest
                        </button>
                        <button
                            type="button"
                            onClick={() => setLayoutMode('web')}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${layoutMode === 'web'
                                ? 'border-cyan-400/40 bg-cyan-400/12 text-cyan-100'
                                : 'border-slate-700/70 bg-slate-900/50 text-slate-300 hover:border-cyan-400/20'
                                }`}
                        >
                            Web
                        </button>
                        <button
                            type="button"
                            onClick={() => setLayoutMode('structured')}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${layoutMode === 'structured'
                                ? 'border-cyan-400/40 bg-cyan-400/12 text-cyan-100'
                                : 'border-slate-700/70 bg-slate-900/50 text-slate-300 hover:border-cyan-400/20'
                                }`}
                        >
                            Guided
                        </button>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">
                        {isGuidedMap
                            ? 'Guided keeps the node map draggable while anchoring branches into softer lanes with lighter bridge links.'
                            : 'Forest guides topics into branches. Web keeps the freer spider-map layout.'}
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Spacing</span>
                        <span>{nodeSpacing}px</span>
                    </div>
                    <input
                        type="range"
                        min="80"
                        max="300"
                        value={nodeSpacing}
                        onChange={(e) => setNodeSpacing(Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Tree Spacing</span>
                        <span>{treeSpacing}px</span>
                    </div>
                    <input
                        type="range"
                        min="120"
                        max="280"
                        value={treeSpacing}
                        onChange={(e) => setTreeSpacing(Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="mt-1 text-[10px] text-gray-500">
                        Controls the vertical growth distance between branch levels in guided modes.
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Branch Spread</span>
                        <span>{branchSpread}px</span>
                    </div>
                    <input
                        type="range"
                        min="90"
                        max="240"
                        value={branchSpread}
                        onChange={(e) => setBranchSpread(Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="mt-1 text-[10px] text-gray-500">
                        Widens or tightens sibling branches in the guided layouts.
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Recursion Depth</span>
                        <span>{recursionDepth}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="3"
                        value={recursionDepth}
                        onChange={(e) => setRecursionDepth(Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="mt-1 text-[10px] text-gray-500">
                        Effective max depth: {recursionDepth * 2} (capped at 6).
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Node Size</span>
                        <span>{Math.round(nodeSizeScale * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.6"
                        max="1.6"
                        step="0.05"
                        value={nodeSizeScale}
                        onChange={(e) => setNodeSizeScale(Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Link Visibility</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showCrossLinks}
                            onChange={(e) => setShowCrossLinks(e.target.checked)}
                        />
                        Show cross-tree links
                    </label>
                    <div className="mt-1 text-[10px] text-gray-500">
                        {isGuidedMap
                            ? 'Controls whether dashed bridge links between branches stay visible in Guided mode.'
                            : 'Keeps secondary links between trees visible while forest branches stay readable.'}
                    </div>
                </div>
                {isGuidedMap && (
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/6 px-3 py-2 text-[11px] leading-relaxed text-cyan-50">
                        Guided mode is the hybrid follow-up to the map experiment: softer lane structure, no diagram arrows, and full drag-to-arrange still intact.
                    </div>
                )}
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Discovery</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={includeBacklinks}
                            onChange={(e) => setIncludeBacklinks(e.target.checked)}
                        />
                        Include incoming links (what links here)
                    </label>
                    <div className="mt-1 text-[10px] text-gray-500">
                        Adds connections from other pages that link to this topic.
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>API Contact Email</span>
                    </div>
                    <input
                        type="email"
                        value={apiContactEmail}
                        onChange={(e) => setApiContactEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-black/30 border border-gray-700/70 rounded px-2 py-1 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-green-500/60"
                    />
                    <div className="mt-1 text-[10px] text-gray-500">
                        Used for Wikipedia API identification.
                    </div>
                </div>
            </div>
            {isTouchDevice && (
                <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-100/90 leading-relaxed">
                    Touch shortcuts: open a node, then use <span className="font-semibold">Select For Path</span> in the details sheet. Multi-select deletion remains desktop-only.
                </div>
            )}
            <div className="mt-4 pt-3 border-t border-gray-700/50 text-[9px] text-gray-500 leading-relaxed">
                Protected by reCAPTCHA.{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">Privacy</a>
                {' · '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">Terms</a>
            </div>
        </>
    );

    const mobileDockOffsetClassName = mobileDockMode === 'sheet'
        ? 'bottom-[15.5rem]'
        : mobileDockMode === 'bar'
            ? 'bottom-[4.75rem]'
            : 'bottom-3';

    return (
        <div className={isTouchDevice ? `fixed right-3 ${mobileDockOffsetClassName} z-20 flex flex-col-reverse items-end gap-3 pointer-events-none` : 'fixed bottom-8 left-6 z-20 pointer-events-none'}>
            {!isTouchDevice && (showLegend || showSettings) && (
                <div
                    className={desktopPanelSidecarLeft !== null
                        ? 'pointer-events-none fixed top-6 z-20 flex flex-col gap-3'
                        : 'pointer-events-none absolute left-0 bottom-full mb-3 flex flex-col gap-3'}
                    style={desktopPanelSidecarLeft !== null ? { left: desktopPanelSidecarLeft } : undefined}
                >
                    {showLegend && (
                        <div className={desktopPanelClassName} style={desktopPanelSidecarLeft !== null ? desktopSidecarPanelStyle : desktopPanelStyle}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Legend
                                </h3>
                                <button
                                    onClick={() => setShowLegend(false)}
                                    className="rounded-full border border-gray-700/70 bg-gray-900/70 px-3 py-1 text-[11px] text-gray-300"
                                >
                                    Close
                                </button>
                            </div>
                            {renderLegendContent()}
                        </div>
                    )}
                    {showSettings && (
                        <div className={desktopPanelClassName} style={desktopPanelSidecarLeft !== null ? desktopSidecarPanelStyle : desktopPanelStyle}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Graph Layout
                                </h3>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="rounded-full border border-gray-700/70 bg-gray-900/70 px-3 py-1 text-[11px] text-gray-300"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="mb-3 text-[11px] text-slate-300 leading-relaxed">
                                Tune how the map organizes space, how trees fan out, and how many connections it explores when you expand a topic.
                            </div>
                            {renderSettingsContent()}
                        </div>
                    )}
                </div>
            )}

            <div className={isTouchDevice ? 'pointer-events-auto flex flex-col gap-2 items-end' : 'pointer-events-auto mb-3 flex gap-2'}>
                {isTouchDevice ? (
                    <>
                        <button
                            onClick={toggleSettings}
                            className="w-12 h-12 bg-slate-800/85 border border-slate-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-all"
                            title="Settings"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                                ></path>
                            </svg>
                        </button>

                        <button
                            onClick={toggleLegend}
                            className="w-12 h-12 bg-slate-800/85 border border-slate-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-all"
                            title="Legend"
                            aria-label="Legend"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 110-20 10 10 0 010 20z"
                                />
                            </svg>
                        </button>

                        {onOpenLogs && (
                            <button
                                onClick={onOpenLogs}
                                className="w-12 h-12 bg-slate-800/85 border border-slate-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-all"
                                title="Session Diagnostics"
                                aria-label="Session Diagnostics"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                            </button>
                        )}

                        <button
                            onClick={onPruneLeaves}
                            disabled={!canPruneLeaves}
                            className="w-12 h-12 bg-slate-800/85 border border-slate-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-all disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-slate-800/85"
                            title="Prune leaf topics"
                            aria-label="Prune leaf topics"
                        >
                            <span className="text-lg">✂</span>
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={toggleSettings}
                            className="w-12 h-12 bg-gray-800/80 backdrop-blur-md border border-gray-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-gray-700 text-gray-300 transition-all hover:scale-105"
                            title="Settings"
                            aria-expanded={showSettings}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                                ></path>
                            </svg>
                        </button>

                        <button
                            onClick={toggleLegend}
                            className="w-12 h-12 bg-gray-800/80 backdrop-blur-md border border-gray-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-gray-700 text-gray-300 transition-all hover:scale-105"
                            title="Legend"
                            aria-label="Legend"
                            aria-expanded={showLegend}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 110-20 10 10 0 010 20z"
                                />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {showLegend && isTouchDevice && (
                    <div className={`${mobileSheetClassName} panel-rise`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                Legend
                            </h3>
                            <button
                                onClick={() => setShowLegend(false)}
                                className="rounded-full border border-slate-700/70 bg-slate-800/80 px-3 py-1 text-[11px] text-slate-300"
                            >
                                Close
                            </button>
                        </div>
                        <p className="mb-3 text-[11px] leading-relaxed text-slate-300">
                            Use the line styles below to read how topics connect as the map expands.
                        </p>
                        {renderLegendContent()}
                    </div>
            )}

            {showSettings && isTouchDevice && (
                    <div className={`${mobileSheetClassName} panel-rise`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                Graph Layout
                            </h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="rounded-full border border-slate-700/70 bg-slate-800/80 px-3 py-1 text-[11px] text-slate-300"
                            >
                                Close
                            </button>
                        </div>
                        <div className="mb-3 text-[11px] text-slate-300 leading-relaxed">
                            Tune how the map organizes space, how trees fan out, and how many connections it explores when you expand a topic.
                        </div>
                        {renderSettingsContent()}
                    </div>
            )}

            {!isTouchDevice && (
                <div className="pointer-events-auto flex flex-col gap-3">
                    <div className="flex gap-2 bg-gray-900/80 backdrop-blur-md border border-gray-700/60 rounded-2xl p-2 shadow-2xl">
                        <button
                            onClick={onPruneLeaves}
                            disabled={!canPruneLeaves}
                            className="h-10 sm:h-12 px-3 sm:px-5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-600/50 rounded-xl shadow-xl flex items-center justify-center gap-1.5 sm:gap-2 text-gray-200 hover:text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gray-800/80 disabled:hover:text-gray-200"
                            title="Remove nodes with fewer than 2 connections"
                        >
                            <span className="text-base sm:text-lg">✂️</span>
                            <span className="font-semibold text-xs sm:text-sm">Prune</span>
                        </button>

                        <button
                            onClick={onDeleteSelection}
                            disabled={!canDeleteSelection}
                            className="h-10 sm:h-12 px-3 sm:px-5 bg-gray-800/70 hover:bg-red-900/80 border border-gray-600/50 hover:border-red-500/50 rounded-xl shadow-xl flex items-center justify-center gap-1.5 sm:gap-2 text-gray-200 hover:text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gray-800/70 disabled:hover:text-gray-200 disabled:hover:border-gray-600/50"
                            title={canDeleteSelection ? 'Delete Alt/Option+Drag selected nodes' : 'Select nodes on desktop before deleting'}
                        >
                            <span className="text-base sm:text-lg">🗑️</span>
                            <span className="font-semibold text-xs sm:text-sm">Delete Selection</span>
                        </button>
                    </div>

                    <div className="max-w-[21rem] rounded-2xl border border-gray-700/60 bg-gray-900/80 px-3 py-3 text-xs leading-relaxed text-slate-400 shadow-2xl backdrop-blur-md">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-200">Built by Monroe</span>
                            <a
                                href={PERSONAL_SITE_URL}
                                target="_blank"
                                rel="me noopener noreferrer"
                                className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                            >
                                monroes.tech
                            </a>
                            <a
                                href={PROJECT_GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2.5 py-1 text-[11px] font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                            >
                                GitHub
                            </a>
                        </div>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            Independent project using Wikipedia content. Not affiliated with or endorsed by the Wikimedia Foundation.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
