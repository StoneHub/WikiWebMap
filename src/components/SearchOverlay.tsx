import React from 'react';

interface SearchOverlayProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    loading: boolean;
    error: string;
    suggestions: string[];
    showSuggestions: boolean;
    setShowSuggestions: (show: boolean) => void;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onAddTopic: (topic: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
    searchTerm,
    setSearchTerm,
    loading,
    error,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    onSearchChange,
    onAddTopic,
}) => {
    return (
        <div className="absolute top-6 left-6 z-20 w-96 max-w-full">
            <div className="bg-gray-800/90 backdrop-blur-md border border-gray-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
                <h1 className="text-xl font-bold text-blue-400 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    WikiWeb Explorer
                </h1>

                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={onSearchChange}
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        onBlur={() => {
                            setTimeout(() => setShowSuggestions(false), 200);
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && onAddTopic(searchTerm)}
                        placeholder="Evaluate topic..."
                        className="w-full pl-4 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder-gray-500 text-white"
                    />
                </div>

                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto overflow-hidden">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                className="w-full text-left px-4 py-3 hover:bg-gray-700/50 text-sm text-gray-200 transition border-b border-gray-700/50 last:border-0"
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

                <button
                    onClick={() => onAddTopic(searchTerm)}
                    disabled={loading || !searchTerm}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold shadow-lg transition-all transform active:scale-95 text-white"
                >
                    {loading ? 'Thinking...' : 'Start Exploration'}
                </button>

                {error && (
                    <div
                        className={`text-xs px-2 py-1 rounded bg-red-900/20 border border-red-500/30 ${error.startsWith('Path found')
                                ? 'text-green-400 border-green-500/30'
                                : 'text-red-400'
                            }`}
                    >
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
