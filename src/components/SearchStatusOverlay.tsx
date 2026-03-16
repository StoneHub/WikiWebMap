import { useEffect, useState } from 'react';
import type { SearchProgress } from '../types/SearchProgress';

type SearchJob = {
  id: string;
  from: string;
  to: string;
  source: string;
};

type SearchStatusOverlayProps = {
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
  queue: SearchJob[];
  activeSearch: SearchJob | null;
  onDeleteQueued: (id: string) => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  persistentVisible: boolean;
  isTouchDevice: boolean;
  onOpenLogs?: () => void;
};

const mobileShellClassName = 'fixed inset-x-0 bottom-0 z-20 pointer-events-none';
const mobilePanelClassName = 'pointer-events-auto mx-3 rounded-t-[1.75rem] border border-slate-700/70 bg-slate-900/94 px-4 py-3 shadow-[0_-18px_48px_rgba(2,6,23,0.62)] backdrop-blur-xl';

const sourceLabel = (source: string) => source === 'suggested' ? 'Curated path' : 'Selected topics';

function getStateMeta(props: SearchStatusOverlayProps, hasActiveSearch: boolean, hasQueuedSearches: boolean) {
  if (props.searchProgress.isPaused) {
    return {
      label: 'Paused',
      dotClassName: 'bg-amber-400',
      badgeClassName: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    };
  }
  if (hasActiveSearch) {
    return {
      label: 'Searching',
      dotClassName: 'bg-cyan-400 animate-pulse',
      badgeClassName: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100',
    };
  }
  if (hasQueuedSearches) {
    return {
      label: 'Queued',
      dotClassName: 'bg-indigo-400',
      badgeClassName: 'border-indigo-400/25 bg-indigo-400/10 text-indigo-100',
    };
  }
  if (props.keepSearching) {
    return {
      label: 'Auto Continue',
      dotClassName: 'bg-emerald-400',
      badgeClassName: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    };
  }
  return {
    label: 'Ready',
    dotClassName: 'bg-slate-500',
    badgeClassName: 'border-slate-600/70 bg-slate-800/80 text-slate-200',
  };
}

function getActivitySummary(props: SearchStatusOverlayProps, hasActiveSearch: boolean, hasQueuedSearches: boolean) {
  if (props.searchProgress.isPaused) {
    return 'Search is paused. The map stays live while you inspect nodes or resume when ready.';
  }
  if (hasActiveSearch && props.foundCount > 0 && props.keepSearching) {
    return `Found ${props.foundCount} bridge${props.foundCount === 1 ? '' : 's'} already. Continuing automatically to look for alternates.`;
  }
  if (hasActiveSearch) {
    return hasQueuedSearches
      ? 'Scanning linked topics now. The next queued search will start automatically after this pass finishes.'
      : 'Scanning linked topics and updating the map live while the bridge search runs.';
  }
  if (hasQueuedSearches) {
    return `Queued searches start automatically. ${props.queue.length} job${props.queue.length === 1 ? '' : 's'} waiting for the next run slot.`;
  }
  if (props.keepSearching) {
    return 'Alternate-bridge mode stays on, so the next path search will keep looking after the first result.';
  }
  return 'Search activity appears here when you queue a bridge search or ask the pathfinder to keep exploring.';
}

function renderQueue(props: SearchStatusOverlayProps) {
  if (props.queue.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Search Queue
        </div>
        <div className="text-[11px] text-slate-500">
          Runs automatically
        </div>
      </div>
      <div className="space-y-2">
        {props.queue.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-black/20 px-3 py-2 text-[11px]"
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-100">
                {item.from} <span className="text-slate-500">→</span> {item.to}
              </div>
              <div className="mt-1 text-slate-400">
                {index === 0 ? 'Next up' : `Queued #${index + 1}`} · {sourceLabel(item.source)}
              </div>
            </div>
            <button
              onClick={() => props.onDeleteQueued(item.id)}
              className="shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-200 transition hover:bg-red-500/15"
              title="Remove from queue"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchStatusOverlay(props: SearchStatusOverlayProps) {
  const [showDetails, setShowDetails] = useState(false);

  const hasActiveSearch = props.searchProgress.isSearching || Boolean(props.activeSearch);
  const hasQueuedSearches = props.queue.length > 0;
  const hasActivity = hasActiveSearch || hasQueuedSearches || props.persistentVisible;
  const stateMeta = getStateMeta(props, hasActiveSearch, hasQueuedSearches);
  const activitySummary = getActivitySummary(props, hasActiveSearch, hasQueuedSearches);
  const recentLogs = props.searchLog.slice(-4);
  const activeLabel = props.activeSearch
    ? `${props.activeSearch.from} → ${props.activeSearch.to}`
    : hasActiveSearch
      ? props.searchProgress.currentPage || 'Pathfinder running'
      : hasQueuedSearches
        ? `${props.queue.length} queued search${props.queue.length === 1 ? '' : 'es'}`
        : 'Search activity ready';

  useEffect(() => {
    setShowDetails(false);
  }, [props.activeSearch?.id]);

  useEffect(() => {
    if (!hasActivity) setShowDetails(false);
  }, [hasActivity]);

  const renderStats = () => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Depth</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">
          {hasActiveSearch ? `D${props.searchProgress.currentDepth}/${props.searchProgress.maxDepth}` : 'Standby'}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scanned</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">{props.searchProgress.exploredCount}</div>
      </div>
      <div className="rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Queued</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">{props.queue.length}</div>
      </div>
      <div className="rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Found</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">{props.foundCount}</div>
      </div>
    </div>
  );

  const renderDetails = () => {
    if (!showDetails) return null;

    return (
      <div className="space-y-3">
        {recentLogs.length > 0 && (
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Recent Events
            </div>
            <div className="space-y-2 text-[11px] leading-relaxed text-slate-300">
              {recentLogs.map((log, index) => (
                <div key={`${log}-${index}`} className="border-l border-cyan-400/20 pl-3">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
        {renderQueue(props)}
      </div>
    );
  };

  if (hasActivity) {
    if (props.isMinimized) {
      if (props.isTouchDevice) {
        return (
          <div className={mobileShellClassName}>
            <div className={mobilePanelClassName}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                    <span className={`inline-block h-2 w-2 rounded-full ${stateMeta.dotClassName}`} />
                    Search Activity
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-100">{activeLabel}</div>
                </div>
                <button
                  onClick={props.onToggleMinimize}
                  className="shrink-0 rounded-full border border-slate-600/60 bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-cyan-400/35 hover:bg-cyan-400/10"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="fixed bottom-[11.25rem] left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-30 pointer-events-none sm:w-[22rem]">
          <div className="pointer-events-auto rounded-2xl border border-slate-700/70 bg-slate-900/88 px-4 py-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                  <span className={`inline-block h-2 w-2 rounded-full ${stateMeta.dotClassName}`} />
                  Search Activity
                </div>
                <div className="mt-1 truncate text-sm text-slate-100">{activeLabel}</div>
              </div>
              <button
                onClick={props.onToggleMinimize}
                className="shrink-0 rounded-full border border-slate-600/60 bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-cyan-400/35 hover:bg-cyan-400/10"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      );
    }

    const wrapperClassName = props.isTouchDevice
      ? mobileShellClassName
      : props.isDocked
        ? 'absolute z-30 w-[22rem] pointer-events-none'
        : 'fixed bottom-[11.25rem] right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-30 pointer-events-none sm:w-[22rem]';

    const wrapperStyle = props.isDocked && props.dockPosition
      ? {
          left: props.dockPosition.x,
          top: props.dockPosition.y,
          transform: 'translate(-50%, -100%) translateY(-15px)',
        }
      : undefined;

    const panelClassName = props.isTouchDevice
      ? mobilePanelClassName
      : 'pointer-events-auto rounded-2xl border border-slate-700/70 bg-slate-900/92 px-4 py-4 shadow-2xl backdrop-blur-md';

    return (
      <div className={wrapperClassName} style={wrapperStyle}>
        {props.isDocked && !props.isTouchDevice && (
          <div className="absolute bottom-[-10px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-slate-700/70 bg-slate-900/92" />
        )}
        <div className={panelClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${stateMeta.badgeClassName}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${stateMeta.dotClassName}`} />
                  {stateMeta.label}
                </div>
                {props.activeSearch && (
                  <span className="rounded-full border border-slate-700/70 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    {sourceLabel(props.activeSearch.source)}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Search Activity
              </div>
              <div className="mt-1 text-sm font-semibold leading-relaxed text-white">
                {activeLabel}
              </div>
            </div>
            <button
              onClick={props.onToggleMinimize}
              className="shrink-0 rounded-full border border-slate-600/60 bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-cyan-400/35 hover:bg-cyan-400/10"
              title="Collapse search activity"
            >
              Hide
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-3 text-[11px] leading-relaxed text-slate-300">
            {activitySummary}
          </div>

          <div className="mt-3">
            {renderStats()}
          </div>

          <button
            onClick={props.onToggleKeepSearching}
            className={`mt-3 w-full rounded-2xl border px-3 py-2 text-center text-[11px] font-medium transition ${
              props.keepSearching
                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                : 'border-slate-700/70 bg-slate-950/40 text-slate-300'
            }`}
            title="Continue looking for alternate bridges after the first result is found."
          >
            {props.keepSearching ? 'Find Alternate Bridges: On' : 'Find Alternate Bridges: Off'}
          </button>

          {recentLogs.length > 0 && !showDetails && (
            <div className="mt-3 rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2 text-[11px] text-slate-300">
              {recentLogs[recentLogs.length - 1]}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setShowDetails(value => !value)}
              className="flex-1 rounded-2xl border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/8"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            {props.onOpenLogs && (
              <button
                onClick={props.onOpenLogs}
                className="flex-1 rounded-2xl border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/8"
              >
                Diagnostics
              </button>
            )}
          </div>

          {renderDetails()}

          {hasActiveSearch && (
            <div className="mt-3 flex gap-2">
              {!props.searchProgress.isPaused ? (
                <button
                  onClick={props.onPauseSearch}
                  className="flex-1 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/15"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={props.onResumeSearch}
                  className="flex-1 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  Resume
                </button>
              )}
              <button
                onClick={props.onCancelSearch}
                className="flex-1 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/15"
              >
                Stop Search
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (props.isTouchDevice) {
    return null;
  }

  return (
    <div className="fixed bottom-[11.25rem] right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-20 pointer-events-none">
      <div className="max-w-[min(32rem,calc(100vw-1.5rem))] rounded-2xl border border-gray-700/40 bg-gray-900/72 px-3 py-2 text-[11px] text-gray-400 shadow-lg backdrop-blur-md pointer-events-auto">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Nodes: <strong className="text-gray-200">{props.nodeCount}</strong>
          </span>
          <span>
            Connections: <strong className="text-gray-200">{props.linkCount}</strong>
          </span>
          <span>
            Path:{' '}
            <strong className="text-gray-200">
              {props.isTouchDevice ? 'Select For Path' : 'Shift+Click'}
            </strong>
          </span>
          <span>
            {props.isTouchDevice ? 'Delete selection:' : 'Select:'}{' '}
            <strong className="text-gray-200">
              {props.isTouchDevice ? 'Desktop only' : 'Alt+Drag'}
            </strong>
          </span>
          {props.onOpenLogs && (
            <button
              onClick={props.onOpenLogs}
              className="ml-auto rounded-full p-1 text-blue-300 transition hover:bg-gray-700/50 hover:text-blue-200"
              title="View Session Diagnostics"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-2 border-t border-white/5 pt-2 text-[11px] leading-relaxed text-gray-400">
          Start with one topic to seed the graph, or use a curated path card to watch WikiWebMap search for a bridge between two ideas.
        </div>
      </div>
    </div>
  );
}
