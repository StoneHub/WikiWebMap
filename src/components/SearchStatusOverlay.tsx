import type { SearchProgress } from '../types/SearchProgress';

export function SearchStatusOverlay(props: {
  searchProgress: SearchProgress;
  searchLog: string[];
  nodeCount: number;
  linkCount: number;
  onCancelSearch: () => void;
}) {
  if (props.searchProgress.isSearching) {
    return (
      <div className="absolute bottom-6 left-6 z-30 w-80">
        <div className="bg-black/90 backdrop-blur-md border border-green-500/50 rounded-xl p-4 shadow-2xl font-mono text-xs text-green-400">
          <div className="flex justify-between items-center mb-2 border-b border-green-500/30 pb-2">
            <span className="animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              SEARCHING MATRIX
            </span>
            <span>{props.searchProgress.exploredCount} nodes</span>
          </div>
          <div className="space-y-1 h-32 overflow-hidden flex flex-col justify-end">
            {props.searchLog.map((log, i) => (
              <div key={i} className="truncate opacity-80 border-l border-green-500/20 pl-2">
                {log}
              </div>
            ))}
          </div>
          <button
            onClick={props.onCancelSearch}
            className="mt-3 w-full border border-red-900 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded px-2 py-1 text-center transition"
          >
            ABORT SEQUENCE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
      <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/30 rounded-full px-4 py-2 text-xs text-gray-400 flex gap-4 shadow-lg">
        <span>
          Nodes: <strong className="text-gray-200">{props.nodeCount}</strong>
        </span>
        <span>
          Connections: <strong className="text-gray-200">{props.linkCount}</strong>
        </span>
      </div>
    </div>
  );
}
