import React from 'react';
import { Node as GraphNode } from '../GraphManager';

interface NodeDetailsPanelProps {
    clickedNode: GraphNode | null;
    clickedSummary: string;
    clickedDescription?: string;
    clickedCategories?: string[];
    clickedBacklinkCount?: number;
    nodeThumbnails: Record<string, string>;
    isPathSelected: boolean;
    pathSelectionCount: number;
    onClose: () => void;
    onExpand: (id: string) => void;
    onTogglePathSelection: () => Promise<void>;
    onDelete: (id: string) => void;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
    clickedNode,
    clickedSummary,
    clickedDescription,
    clickedCategories,
    clickedBacklinkCount,
    nodeThumbnails,
    isPathSelected,
    pathSelectionCount,
    onClose,
    onExpand,
    onTogglePathSelection,
    onDelete,
}) => {
    if (!clickedNode) return null;

    const thumbnail = nodeThumbnails[clickedNode.title];

    return (
        <div className="fixed inset-x-0 bottom-0 z-30 sm:absolute sm:inset-auto sm:top-6 sm:right-6 sm:w-80 sm:max-w-[90vw]">
            <div className="mx-3 mb-3 sm:mx-0 sm:mb-0 bg-gray-800/95 backdrop-blur-xl border border-gray-600/50 rounded-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex max-h-[78vh] sm:max-h-none flex-col animate-fade-in-right">
                <div className="flex justify-center py-2 sm:hidden">
                    <div className="h-1.5 w-12 rounded-full bg-gray-500/50" />
                </div>
                <div className="relative h-36 sm:h-40 bg-gray-900 skeleton-loader">
                    {thumbnail ? (
                        <img
                            src={thumbnail}
                            alt={clickedNode.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl font-serif italic">
                            W
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-1 text-white backdrop-blur-sm transition"
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

                <div className="overflow-y-auto p-5">
                    <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                        {clickedNode.title}
                    </h2>
                    {(clickedDescription || typeof clickedBacklinkCount === 'number') && (
                        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-gray-300">
                            {clickedDescription && (
                                <span className="px-2 py-1 rounded-full bg-gray-700/50 border border-gray-600/40">
                                    {clickedDescription}
                                </span>
                            )}
                            {typeof clickedBacklinkCount === 'number' && (
                                <span className="px-2 py-1 rounded-full bg-orange-900/30 border border-orange-700/40 text-orange-200">
                                    Backlinks: {clickedBacklinkCount}
                                </span>
                            )}
                        </div>
                    )}
                    <p className="text-sm text-gray-300 mb-4 leading-relaxed max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2">
                        {clickedSummary || 'Loading summary...'}
                    </p>
                    {clickedCategories && clickedCategories.length > 0 && (
                        <div className="mb-4">
                            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Categories</div>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-1">
                                {clickedCategories.slice(0, 18).map(cat => (
                                    <span
                                        key={cat}
                                        className="text-[11px] px-2 py-1 rounded-full bg-black/20 border border-gray-700/60 text-gray-200"
                                        title={cat}
                                    >
                                        {cat}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() =>
                                window.open(
                                    `https://en.wikipedia.org/wiki/${encodeURIComponent(clickedNode.title)}`,
                                    '_blank'
                                )
                            }
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-xs font-medium transition text-white"
                        >
                            Read Article ↗
                        </button>
                        <button
                            onClick={() => onExpand(clickedNode.id)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-medium transition shadow-lg shadow-indigo-500/20 text-white"
                        >
                            Expand
                        </button>
                        <button
                            onClick={() => void onTogglePathSelection()}
                            className={`col-span-2 px-4 py-2 rounded-xl text-xs font-medium transition border ${
                                isPathSelected
                                    ? 'bg-blue-500/15 border-blue-400/30 text-blue-100'
                                    : 'bg-gray-700/60 hover:bg-gray-600/60 text-gray-100 border-gray-600/40'
                            }`}
                            title="Select this topic as one of two path endpoints"
                        >
                            {isPathSelected
                                ? `Selected For Path (${pathSelectionCount}/2)`
                                : `Select For Path (${pathSelectionCount}/2)`}
                        </button>
                    </div>
                    <button
                        onClick={() => onDelete(clickedNode.id)}
                        className="mt-3 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl text-xs transition border border-red-500/20"
                    >
                        Remove from Graph
                    </button>
                </div>
            </div>
        </div>
    );
};
