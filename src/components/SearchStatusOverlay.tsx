import type { SearchProgress } from '../types/SearchProgress';

export function SearchStatusOverlay(props: {
  searchProgress: SearchProgress;
  searchLog: string[];
  nodeCount: number;
  linkCount: number;
  onCancelSearch: () => void;
  onPauseSearch: () => void;
  onResumeSearch: () => void;
  isDocked: boolean;
  dockPosition?: { x: number; y: number };
  keepSearching: boolean;
  onToggleKeepSearching: () => void;
  foundCount: number;
}) {
  if (props.searchProgress.isSearching) {
    const wrapperClassName = props.isDocked
      ? 'absolute z-30 w-80 pointer-events-none'
      : 'absolute bottom-6 left-6 z-30 w-80 pointer-events-none';

    const wrapperStyle = props.isDocked && props.dockPosition
      ? {
        left: props.dockPosition.x,
        top: props.dockPosition.y,
        transform: 'translate(-50%, -100%) translateY(-15px)',
      }
      : undefined;

    return (
      <div className={wrapperClassName} style={wrapperStyle}>
        {props.isDocked && (
          <div className="absolute bottom-[-10px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-900 rotate-45 border-r border-b border-green-500/50"></div>
        )}
        <div className="bg-black/90 backdrop-blur-md border border-green-500/50 rounded-xl p-4 shadow-2xl font-mono text-xs text-green-400 pointer-events-auto">
          <div className="flex justify-between items-center mb-2 border-b border-green-500/30 pb-2">
            <span className={`${props.searchProgress.isPaused ? '' : 'animate-pulse '}flex items-center gap-2`}>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {props.searchProgress.isPaused ? 'PAUSED' : 'SEARCHING'}
            </span>
            <span>
              D{props.searchProgress.currentDepth}/{props.searchProgress.maxDepth} · {props.searchProgress.exploredCount} nodes
            </span>
          </div>
          <div className="mb-2 text-[10px] text-green-400/70 flex gap-3">
            <span className="truncate">Page: {props.searchProgress.currentPage || '-'}</span>
            <span>Queue: {props.searchProgress.queueSize}</span>
            <span>Found: {props.foundCount}</span>
          </div>
          <button
            onClick={props.onToggleKeepSearching}
            className={`mb-2 w-full border rounded px-2 py-1 text-center transition text-[10px] tracking-wide ${props.keepSearching
              ? 'border-green-800 bg-green-900/20 text-green-300 hover:bg-green-900/35'
              : 'border-gray-700 bg-gray-900/20 text-gray-300 hover:bg-gray-900/35'
              }`}
            title="When enabled, keeps searching after the first path is found."
          >
            {props.keepSearching ? 'KEEP SEARCHING: ON' : 'KEEP SEARCHING: OFF'}
          </button>
          <div className="space-y-1 h-32 overflow-hidden flex flex-col justify-end">
            {props.searchLog.map((log, i) => (
              <div key={i} className="truncate opacity-80 border-l border-green-500/20 pl-2">
                {log}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {!props.searchProgress.isPaused ? (
              <button
                onClick={props.onPauseSearch}
                className="flex-1 border border-yellow-900 bg-yellow-900/20 text-yellow-300 hover:bg-yellow-900/40 rounded px-2 py-1 text-center transition"
              >
                PAUSE
              </button>
            ) : (
              <button
                onClick={props.onResumeSearch}
                className="flex-1 border border-green-900 bg-green-900/20 text-green-300 hover:bg-green-900/40 rounded px-2 py-1 text-center transition"
              >
                RESUME
              </button>
            )}
            <button
              onClick={props.onCancelSearch}
              className="flex-1 border border-red-900 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded px-2 py-1 text-center transition"
            >
              ABORT
            </button>
          </div>
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
        <span className="hidden sm:inline">
          Path: <strong className="text-gray-200">Shift+Click</strong>
        </span>
        <span className="hidden sm:inline">
          Select: <strong className="text-gray-200">Alt+Drag</strong>
        </span>
      </div>
    </div>
  );
}
