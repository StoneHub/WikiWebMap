import React from 'react';

interface GraphControlsProps {
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
    nodeSpacing: number;
    setNodeSpacing: (spacing: number) => void;
    recursionDepth: number;
    setRecursionDepth: (depth: number) => void;
    nodeSizeScale: number;
    setNodeSizeScale: (scale: number) => void;
    apiContactEmail: string;
    setApiContactEmail: (email: string) => void;
    nodeCount: number;
    linkCount: number;
    onPruneLeaves: () => void;
    onDeleteSelection: () => void;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
    showSettings,
    setShowSettings,
    nodeSpacing,
    setNodeSpacing,
    recursionDepth,
    setRecursionDepth,
    nodeSizeScale,
    setNodeSizeScale,
    apiContactEmail,
    setApiContactEmail,
    nodeCount,
    linkCount,
    onPruneLeaves,
    onDeleteSelection,
}) => {
    return (
        <div className="fixed bottom-3 right-3 md:bottom-8 md:right-6 z-20 flex flex-col items-end gap-2 md:gap-3 pointer-events-none">
            <div className="pointer-events-auto">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-12 h-12 bg-gray-800/80 backdrop-blur-md border border-gray-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-gray-700 text-gray-300 transition-all hover:scale-105"
                    title="Settings"
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
            </div>

            {/* Settings Bubble */}
            {showSettings && (
                <div className="bg-gray-800/90 backdrop-blur-md border border-gray-700/50 rounded-2xl p-4 shadow-2xl w-full md:w-64 animate-fade-in-up pointer-events-auto">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Graph Physics
                    </h3>
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
                </div>
            )}

            <div className="flex w-full md:w-auto gap-2 bg-gray-900/80 backdrop-blur-md border border-gray-700/60 rounded-2xl p-2 shadow-2xl pointer-events-auto">
                <button
                    onClick={onPruneLeaves}
                    className="h-12 px-5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-600/50 rounded-xl shadow-xl flex-1 md:flex-none flex items-center justify-center gap-2 text-gray-200 hover:text-white transition-all hover:scale-[1.02]"
                    title="Remove nodes with fewer than 2 connections"
                >
                    <span className="text-lg">✂️</span>
                    <span className="font-semibold text-sm">Prune</span>
                </button>

                <button
                    onClick={onDeleteSelection}
                    className="h-12 px-5 bg-gray-800/70 hover:bg-red-900/80 border border-gray-600/50 hover:border-red-500/50 rounded-xl shadow-xl flex-1 md:flex-none flex items-center justify-center gap-2 text-gray-200 hover:text-white transition-all hover:scale-[1.02]"
                    title="Delete Alt/Option+Drag selected nodes"
                >
                    <span className="text-lg">🗑️</span>
                    <span className="font-semibold text-sm">Delete</span>
                </button>
            </div>
        </div>
    );
};
