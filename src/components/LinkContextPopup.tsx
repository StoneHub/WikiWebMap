import React from 'react';
// import { Link } from '../GraphManager'; // Can't import interface easily if it's not exported well or circular. Type loosely for now or export properly.
// Best to just redeclare minimal type or import if clean.
import { Link } from '../GraphManager';

interface LinkContextPopupProps {
    link: Link;
    position: { x: number; y: number };
    onClose: () => void;
}

export const LinkContextPopup: React.FC<LinkContextPopupProps> = ({
    link,
    position,
    onClose,
}) => {
    return (
        <div
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%) translateY(-15px)', // Center horizontally, place above link
            }}
            className="absolute z-40 w-64 animate-pop-in pointer-events-none"
        >
            {/* The Pointer */}
            <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 rotate-45 border-r border-b border-green-500/50"></div>

            <div className="bg-gray-900/95 backdrop-blur-md border border-green-500/50 rounded-xl p-3 shadow-2xl relative pointer-events-auto">
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

                <div className="mb-2">
                    <span className="text-[10px] uppercase font-bold text-green-400 tracking-wider">
                        Connection
                    </span>
                    <div className="text-xs text-white truncate font-bold">
                        {typeof link.source === 'object' ? (link.source as any).title : link.source} ↔{' '}
                        {typeof link.target === 'object' ? (link.target as any).title : link.target}
                    </div>
                </div>

                <div className="bg-black/40 rounded p-2 border border-green-900/30">
                    <p className="text-[10px] text-gray-300 italic leading-relaxed line-clamp-3">
                        "{link.context || 'Context text unavailable.'}"
                    </p>
                </div>
            </div>
        </div>
    );
};
