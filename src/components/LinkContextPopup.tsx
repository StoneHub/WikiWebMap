import React from 'react';
// import { Link } from '../GraphManager'; // Can't import interface easily if it's not exported well or circular. Type loosely for now or export properly.
// Best to just redeclare minimal type or import if clean.
import { Link } from '../GraphManager';

interface LinkContextPopupProps {
    link: Link;
    position: { x: number; y: number };
    onClose: () => void;
    scale?: number;
}

export const LinkContextPopup: React.FC<LinkContextPopupProps> = ({
    link,
    position,
    onClose,
    scale = 1,
}) => {
    const clampedScale = Math.min(1.15, Math.max(0.75, scale));
    const width = Math.round(256 * clampedScale);

    const linkType = (link.type || 'auto') as string;
    const typeLabel = (() => {
        if (linkType.includes('backlink')) return 'Incoming link';
        if (linkType === 'path') return 'Path result';
        if (linkType === 'manual') return 'Manual add';
        if (linkType === 'expand') return 'Expanded outlink';
        if (linkType === 'auto') return 'Auto connection';
        return linkType;
    })();

    const isLoadingContext = !link.context;
    const contextText = link.context || '';
    return (
        <div
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%) translateY(-15px)', // Center horizontally, place above link
                width,
            }}
            className="absolute z-40 animate-pop-in pointer-events-none"
        >
            {/* The Pointer */}
            <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 rotate-45 border-r border-b border-green-500/50"></div>

            <div
                className="bg-gray-900/95 backdrop-blur-md border border-green-500/50 rounded-xl shadow-2xl relative pointer-events-auto"
                style={{ padding: Math.round(12 * clampedScale) }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-1 right-1 p-1 bg-gray-800/50 rounded-full text-gray-400 hover:text-white"
                    title="Close Context" // Accessible text
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                        ></path>
                    </svg>
                </button>

                <div style={{ marginBottom: Math.round(8 * clampedScale) }}>
                    <span className="text-[10px] uppercase font-bold text-green-400 tracking-wider">
                        Connection
                    </span>
                    <div className="text-xs text-white truncate font-bold">
                        {typeof link.source === 'object' ? (link.source as any).title : link.source}{' '}
                        {linkType.includes('backlink') ? '→' : '↔'}{' '}
                        {typeof link.target === 'object' ? (link.target as any).title : link.target}
                    </div>
                    <div className="mt-1 text-[10px] text-gray-400">
                        {typeLabel}
                    </div>
                </div>

                <div className="bg-black/40 rounded border border-green-900/30" style={{ padding: Math.round(8 * clampedScale) }}>
                    {isLoadingContext ? (
                        <div className="animate-pulse">
                            <div className="flex items-center gap-2 mb-2">
                                <span
                                    className="inline-block w-3 h-3 rounded-full border-2 border-gray-500/60 border-t-green-400/80 animate-spin"
                                />
                                <span className="text-[10px] text-gray-400">Loading snippet…</span>
                            </div>
                            <div className="space-y-2">
                                <div className="h-2 rounded bg-gray-700/60 w-11/12" />
                                <div className="h-2 rounded bg-gray-700/50 w-full" />
                                <div className="h-2 rounded bg-gray-700/40 w-9/12" />
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] text-gray-300 italic leading-relaxed line-clamp-3">
                            "{contextText}"
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
