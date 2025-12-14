import React from 'react';

interface GraphControlsProps {
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
    nodeSpacing: number;
    setNodeSpacing: (spacing: number) => void;
    searchDepth: number;
    setSearchDepth: (depth: number) => void;
    apiContactEmail: string;
    setApiContactEmail: (email: string) => void;
    onPrune: () => void;
    onRunAutoTest: () => void;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
    showSettings,
    setShowSettings,
    nodeSpacing,
    setNodeSpacing,
    searchDepth,
    setSearchDepth,
    apiContactEmail,
    setApiContactEmail,
    onPrune,
    onRunAutoTest,
}) => {
    return (
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-3">
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

            {/* Settings Bubble */}
            {showSettings && (
                <div className="bg-gray-800/90 backdrop-blur-md border border-gray-700/50 rounded-2xl p-4 shadow-2xl w-64 mb-1 animate-fade-in-up">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Graph Physics
                    </h3>
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
                                <span>Max Depth</span>
                                <span>{searchDepth}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="6"
                                value={searchDepth}
                                onChange={(e) => setSearchDepth(Number(e.target.value))}
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
                        {/* Auto Test Button */}
                        <button
                            onClick={onRunAutoTest}
                            className="w-full py-2 bg-purple-900/30 border border-purple-500/50 text-purple-300 text-xs rounded hover:bg-purple-900/50 transition"
                        >
                            🛠️ Run Auto-Test (Physics → Science)
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={onPrune}
                className="h-12 px-6 bg-gray-800/80 hover:bg-red-900/80 backdrop-blur-md border border-gray-600/50 hover:border-red-500/50 rounded-full shadow-xl flex items-center gap-2 text-gray-200 hover:text-white transition-all hover:scale-105"
                title="Clean up isolated nodes"
            >
                <span className="text-lg">✂️</span>
                <span className="font-semibold text-sm">Prune</span>
            </button>
        </div>
    );
};
