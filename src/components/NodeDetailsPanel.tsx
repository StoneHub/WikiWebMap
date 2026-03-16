import React from 'react';
import { Node as GraphNode } from '../GraphManager';
import { type LayoutMode } from '../features/layout/layoutConfig';

interface NodeDetailsPanelProps {
    clickedNode: GraphNode | null;
    clickedSummary: string;
    clickedDescription?: string;
    clickedCategories?: string[];
    clickedBacklinkCount?: number;
    nodeThumbnails: Record<string, string>;
    layoutMode: LayoutMode;
    isPinned: boolean;
    isBranchCollapsed: boolean;
    isPathSelected: boolean;
    pathSelectionCount: number;
    onClose: () => void;
    onExpand: (id: string) => void;
    onTogglePathSelection: () => Promise<void>;
    onTogglePin: () => void;
    onToggleBranchCollapse: () => void;
    onPruneBranch: () => void;
    onRelayoutTree: () => void;
    onDelete: (id: string) => void;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
    clickedNode,
    clickedSummary,
    clickedDescription,
    clickedCategories,
    clickedBacklinkCount,
    nodeThumbnails,
    layoutMode,
    isPinned,
    isBranchCollapsed,
    isPathSelected,
    pathSelectionCount,
    onClose,
    onExpand,
    onTogglePathSelection,
    onTogglePin,
    onToggleBranchCollapse,
    onPruneBranch,
    onRelayoutTree,
    onDelete,
}) => {
    if (!clickedNode) return null;

    const thumbnail = nodeThumbnails[clickedNode.title];

    return (
        <div className="fixed inset-0 z-40 flex items-end sm:block sm:top-6 sm:right-6 sm:left-auto sm:bottom-auto">
            <button
                type="button"
                onClick={onClose}
                aria-label="Close topic details"
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] sm:hidden"
            />
            <div className="relative z-10 w-full sm:w-80 sm:max-w-[90vw]">
                <div className="bg-slate-900/96 backdrop-blur-xl border border-slate-700/70 rounded-t-[2rem] sm:rounded-2xl shadow-[0_-24px_80px_rgba(2,6,23,0.72)] sm:shadow-2xl overflow-hidden flex max-h-[84vh] sm:max-h-none flex-col animate-fade-in-right">
                    <div className="flex justify-center py-2 sm:hidden">
                        <div className="h-1.5 w-12 rounded-full bg-slate-500/50" />
                    </div>
                    <div className="relative h-32 sm:h-40 bg-slate-950 skeleton-loader">
                        {thumbnail ? (
                            <img
                                src={thumbnail}
                                alt={clickedNode.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-700 text-4xl font-serif italic">
                                W
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 rounded-full p-2 text-white backdrop-blur-sm transition"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                ></path>
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 pb-4">
                        <div className="-mt-7 rounded-[1.5rem] border border-white/10 bg-slate-900/96 px-4 py-4 shadow-lg">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                                Topic Details
                            </div>
                            <h2 className="mt-2 text-xl font-bold text-white leading-tight">
                                {clickedNode.title}
                            </h2>
                            {(clickedDescription || typeof clickedBacklinkCount === 'number') && (
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                                    {clickedDescription && (
                                        <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/70">
                                            {clickedDescription}
                                        </span>
                                    )}
                                    {layoutMode !== 'web' && (
                                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-100">
                                            {layoutMode === 'structured'
                                                ? 'Structured View'
                                                : isPinned
                                                    ? 'Pinned'
                                                    : 'Tree-guided'}
                                        </span>
                                    )}
                                    {typeof clickedBacklinkCount === 'number' && (
                                        <span className="px-2.5 py-1 rounded-full bg-orange-900/30 border border-orange-700/40 text-orange-200">
                                            Backlinks: {clickedBacklinkCount}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 space-y-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Summary</div>
                                <p className="text-sm text-slate-300 leading-relaxed max-h-44 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent pr-2">
                                    {clickedSummary || 'Loading summary...'}
                                </p>
                            </div>

                            {clickedCategories && clickedCategories.length > 0 && (
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Categories</div>
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent pr-1">
                                        {clickedCategories.slice(0, 18).map(cat => (
                                            <span
                                                key={cat}
                                                className="text-[11px] px-2 py-1 rounded-full bg-black/20 border border-slate-700/60 text-slate-200"
                                                title={cat}
                                            >
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-slate-700/60 bg-slate-950/90 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() =>
                                    window.open(
                                        `https://en.wikipedia.org/wiki/${encodeURIComponent(clickedNode.title)}`,
                                        '_blank'
                                    )
                                }
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-xs font-medium transition text-white"
                            >
                                Read Article ↗
                            </button>
                            <button
                                onClick={() => onExpand(clickedNode.id)}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-xs font-medium transition shadow-lg shadow-indigo-500/20 text-white"
                            >
                                Expand
                            </button>
                            {layoutMode === 'forest' && (
                                <>
                                    <button
                                        onClick={onTogglePin}
                                        className={`px-4 py-2.5 rounded-2xl text-xs font-medium transition border ${isPinned
                                            ? 'bg-cyan-400/12 border-cyan-400/30 text-cyan-100'
                                            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 border-slate-700/70'
                                            }`}
                                    >
                                        {isPinned ? 'Unpin Node' : 'Pin Node'}
                                    </button>
                                    <button
                                        onClick={onToggleBranchCollapse}
                                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-2xl text-xs font-medium transition text-white border border-slate-700/70"
                                    >
                                        {isBranchCollapsed ? 'Expand Branch' : 'Collapse Branch'}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => void onTogglePathSelection()}
                                className={`col-span-2 px-4 py-2.5 rounded-2xl text-xs font-medium transition border ${
                                    isPathSelected
                                        ? 'bg-blue-500/15 border-blue-400/30 text-blue-100'
                                        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 border-slate-700/70'
                                }`}
                                title="Select this topic as one of two path endpoints"
                            >
                                {isPathSelected
                                    ? `Selected For Path (${pathSelectionCount}/2)`
                                    : `Select For Path (${pathSelectionCount}/2)`}
                            </button>
                            {layoutMode === 'forest' && (
                                <>
                                    <button
                                        onClick={onRelayoutTree}
                                        className="col-span-1 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/18 text-emerald-200 rounded-2xl text-xs transition border border-emerald-500/20"
                                    >
                                        Relayout Tree
                                    </button>
                                    <button
                                        onClick={onPruneBranch}
                                        className="col-span-1 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/18 text-amber-200 rounded-2xl text-xs transition border border-amber-500/20"
                                    >
                                        Prune Branch
                                    </button>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => onDelete(clickedNode.id)}
                            className="mt-3 w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-2xl text-xs transition border border-red-500/20"
                        >
                            Remove from Graph
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
