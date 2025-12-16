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
  queue: Array<{ id: string; from: string; to: string; source: string }>;
  activeSearch: { id: string; from: string; to: string; source: string } | null;
  onDeleteQueued: (id: string) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  persistentVisible: boolean;
  onOpenLogs?: () => void;
}) {
  const renderQueue = () => {
    if (props.queue.length === 0) return null;
    return (
      <div className="mt-2 border border-green-500/30 rounded-lg p-2 bg-black/40">
        <div className="text-[10px] uppercase tracking-widest text-green-300/80 mb-1">Queued</div>
        <div className="space-y-1 max-h-20 overflow-y-auto">
          {props.queue.map(item => (
            <div key={item.id} className="flex items-center justify-between text-[11px] text-green-200/90 bg-green-900/10 rounded px-2 py-1">
              <span className="truncate">{item.from} → {item.to}</span>
              <button
                onClick={() => props.onDeleteQueued(item.id)}
                className="text-red-300 hover:text-red-200 text-xs px-1"
                title="Remove from queue"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (props.isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-30 pointer-events-none">
        <div className="pointer-events-auto bg-black/80 border border-green-500/40 rounded-full px-3 py-2 text-xs text-green-200 flex items-center gap-2 shadow-lg">
          <span>{props.activeSearch ? `Searching ${props.activeSearch.from} → ${props.activeSearch.to}` : 'Search terminal'}</span>
          {props.queue.length > 0 && <span className="bg-green-700/50 px-2 py-0.5 rounded-full text-[11px]">+{props.queue.length}</span>}
          <button
            onClick={props.onToggleMinimize}
            className="ml-2 px-2 py-0.5 bg-green-600/60 hover:bg-green-500/60 rounded-full text-white text-[11px]"
          >
            Open
          </button>
        </div>
      </div>
    );
  }

  if (props.searchProgress.isSearching) {
    const wrapperClassName = props.isDocked
      ? 'absolute z-30 w-80 pointer-events-none'
      : 'fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-30 sm:w-80 pointer-events-none';

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
            <button
              onClick={props.onToggleMinimize}
              className="ml-2 text-green-300 hover:text-white text-[11px]"
              title="Minimize terminal"
            >
              ⤢
            </button>
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
          {renderQueue()}
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

  if (props.persistentVisible || props.queue.length > 0) {
    return (
      <div className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-20 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md border border-green-500/30 rounded-xl p-3 text-xs text-green-300 shadow-xl pointer-events-auto sm:w-80">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Search Terminal</span>
            <button
              onClick={props.onToggleMinimize}
              className="text-[11px] text-green-200 hover:text-white"
            >
              Minimize
            </button>
          </div>
          {renderQueue() || <div className="text-[11px] text-green-300/70">Queue empty.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-20 pointer-events-none">
      <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/30 rounded-full px-3 sm:px-4 py-2 text-[11px] sm:text-xs text-gray-400 flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 shadow-lg justify-center pointer-events-auto">
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
        {props.onOpenLogs && (
          <button
            onClick={props.onOpenLogs}
            className="ml-1 sm:ml-2 p-1 rounded-full hover:bg-gray-700/50 text-blue-300 hover:text-blue-200 transition"
            title="View Connection Logs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
