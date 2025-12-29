import React from 'react';

type LegendProps = {
    nodeCount: number;
};

export const Legend = ({ nodeCount }: LegendProps) => {
    if (nodeCount === 0) return null;

    return (
        <div className="absolute bottom-4 right-4 bg-gray-800 border border-gray-700 rounded p-3 shadow-lg text-xs pointer-events-none select-none z-10">
            <h4 className="font-bold text-gray-300 mb-2">Node Colors</h4>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-gray-400">User-typed topics</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#9966ff]"></div>
                    <span className="text-gray-400">Auto-discovered</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#ff00ff]"></div>
                    <span className="text-gray-400">Newly added (2s)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-gray-400">Path connection</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                    <span className="text-gray-400">Currently exploring</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span className="text-gray-400">Selected for path</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-[#00ffff]"></div>
                    <span className="text-gray-400">Expanded node</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-gray-400">Error / Failed</span>
                </div>
            </div>
        </div>
    );
};
