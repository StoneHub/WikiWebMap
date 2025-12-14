import React from 'react';
import { Node as GraphNode } from '../GraphManager';

interface NodeDetailsPanelProps {
    clickedNode: GraphNode | null;
    clickedSummary: string;
    nodeThumbnails: Record<string, string>;
    onClose: () => void;
    onExpand: (id: string) => void;
    onPruneLeaves: () => void;
    onDelete: (id: string) => void;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
    clickedNode,
    clickedSummary,
    nodeThumbnails,
    onClose,
    onExpand,
    onPruneLeaves,
    onDelete,
}) => {
    if (!clickedNode) return null;

    const thumbnail = nodeThumbnails[clickedNode.title];

    return (
        <div className="absolute top-6 right-6 z-30 w-80 max-w-[90vw]">
            <div className="bg-gray-800/95 backdrop-blur-xl border border-gray-600/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-right">
                <div className="relative h-40 bg-gray-900 skeleton-loader">
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

                <div className="p-5">
                    <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                        {clickedNode.title}
                    </h2>
                    <p className="text-sm text-gray-300 mb-4 leading-relaxed max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2">
                        {clickedSummary || 'Loading summary...'}
                    </p>
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
                            onClick={onPruneLeaves}
                            className="col-span-2 px-4 py-2 bg-gray-700/60 hover:bg-gray-600/60 rounded-xl text-xs font-medium transition text-gray-100 border border-gray-600/40"
                            title="Remove all nodes with fewer than 2 connections"
                        >
                            Prune Leaves (degree &lt; 2)
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
