import { useEffect, useState } from 'react';
import type { Link, LinkInsightSummary } from '../GraphManager';

export function ConnectionStatusBar(props: {
  link: Link | null;
  linkInsight?: LinkInsightSummary;
  pinnedLinks: Link[];
  selectedPinnedLinkId: string | null;
  isTouchDevice: boolean;
  onSelectPinned: (linkId: string) => void;
  onRemovePinned: (linkId: string) => void;
  onPinToggle: () => void;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
}) {
  const link = props.link;
  const [showFullContext, setShowFullContext] = useState(false);

  useEffect(() => {
    setShowFullContext(false);
  }, [link?.id, props.selectedPinnedLinkId]);

  if (!link && props.pinnedLinks.length === 0) {
    if (props.isTouchDevice) {
      return null;
    }

    return (
      <div className="fixed left-3 right-3 bottom-[6.8rem] sm:bottom-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 pointer-events-none">
        <div className="pointer-events-none bg-gray-900/70 backdrop-blur-md border border-gray-700/60 rounded-2xl shadow-2xl px-4 py-2 text-[11px] text-gray-300">
          {props.isTouchDevice
            ? 'Tap a connection line for context. Tap again to pin it.'
            : 'Hover a connection line for context. Click a line to pin it.'}
        </div>
      </div>
    );
  }

  const source = link ? (typeof link.source === 'object' ? (link.source as any).title : link.source) : '';
  const target = link ? (typeof link.target === 'object' ? (link.target as any).title : link.target) : '';
  const linkType = link ? ((link.type || 'auto') as string) : 'auto';
  const isIncoming = linkType.includes('backlink');
  const direction = isIncoming ? '→' : '↔';
  const isLoading = Boolean(link && !link.context);

  const typeLabel = (() => {
    if (linkType.includes('backlink')) return 'Incoming link';
    if (linkType === 'path') return 'Path result';
    if (linkType === 'manual') return 'Manual add';
    if (linkType === 'expand') return 'Expanded outlink';
    if (linkType === 'auto') return 'Auto connection';
    return linkType;
  })();

  const isPinned = Boolean(link && props.pinnedLinks.some(l => l.id === link.id));
  const hasLongContext = Boolean(link?.context && link.context.length > 180);
  const linkInsight = props.linkInsight;
  const wrapperClassName = props.isTouchDevice
    ? 'fixed inset-x-3 bottom-[6.8rem] z-30 pointer-events-none'
    : 'fixed left-3 right-3 bottom-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 sm:w-[min(720px,calc(100vw-1.5rem))] pointer-events-none';
  const panelClassName = props.isTouchDevice
    ? 'pointer-events-auto rounded-[1.75rem] border border-gray-700/60 bg-gray-900/90 px-4 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.55)] backdrop-blur-md'
    : 'pointer-events-auto bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-2xl shadow-2xl px-4 py-3';

  const relationshipLabel = (() => {
    if (!linkInsight) return null;
    if (linkInsight.role === 'path') return 'Path bridge';
    if (linkInsight.role === 'backlink') return linkInsight.isReciprocal ? 'Mutual backlink' : 'Incoming reference';
    if (linkInsight.role === 'cross') {
      return linkInsight.tier === 'strong' ? 'Strong bridge' : 'Bridge link';
    }
    return linkInsight.tier === 'strong'
      ? 'Strong tie'
      : linkInsight.tier === 'moderate'
        ? 'Related topics'
        : 'Light tie';
  })();

  const relationshipCopy = (() => {
    if (!linkInsight) return null;
    if (linkInsight.role === 'path') {
      return 'This highlighted edge is part of the active bridge the pathfinder reconstructed.';
    }
    if (linkInsight.role === 'cross') {
      return linkInsight.sharedNeighbors > 0
        ? `This bridge jumps between branches and still shares ${linkInsight.sharedNeighbors} nearby topic${linkInsight.sharedNeighbors === 1 ? '' : 's'}.`
        : 'This bridge jumps between branches even though the local neighborhoods stay fairly distinct.';
    }
    if (linkInsight.sharedNeighbors > 0) {
      return `These topics share ${linkInsight.sharedNeighbors} nearby Wikipedia topic${linkInsight.sharedNeighbors === 1 ? '' : 's'}, which is why this connection renders more strongly.`;
    }
    if (linkInsight.isReciprocal) {
      return 'These articles point back to each other, so the relationship gets a stronger visual treatment.';
    }
    return 'This is a lighter connection with less local overlap than the stronger highlighted ties.';
  })();

  return (
    <div className={wrapperClassName}>
      <div className={panelClassName}>
        {props.isTouchDevice && (
          <div className="mb-3 flex justify-center">
            <div className="h-1.5 w-12 rounded-full bg-gray-600/50" />
          </div>
        )}

        {props.pinnedLinks.length > 0 && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700/80 scrollbar-track-transparent">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold shrink-0">
              Pinned
            </div>
            {props.pinnedLinks.map(l => {
              const s = typeof l.source === 'object' ? (l.source as any).title : l.source;
              const t = typeof l.target === 'object' ? (l.target as any).title : l.target;
              const incoming = ((l.type || 'auto') as string).includes('backlink');
              const arrow = incoming ? '→' : '↔';
              const active = props.selectedPinnedLinkId === l.id;
              return (
                <div
                  key={l.id}
                  className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full border ${active ? 'bg-indigo-500/15 border-indigo-400/30 text-indigo-100' : 'bg-gray-800/40 border-gray-700/60 text-gray-200'}`}
                >
                  <button
                    onClick={() => props.onSelectPinned(l.id)}
                    className="text-[11px] whitespace-nowrap max-w-[320px] truncate"
                    title={`${s} ${arrow} ${t}`}
                  >
                    {s} {arrow} {t}
                  </button>
                  <button
                    onClick={() => props.onRemovePinned(l.id)}
                    className="h-5 w-5 rounded-full bg-black/20 hover:bg-black/30 border border-white/10 text-gray-200 flex items-center justify-center"
                    title="Remove pinned"
                    aria-label="Remove pinned"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className={props.isTouchDevice ? 'space-y-3' : 'flex items-start justify-between gap-3'}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/90 font-bold">
                Connection Context
              </div>
              {link && (
                <div className="text-[10px] text-gray-400">
                  {typeLabel}
                </div>
              )}
              {isPinned && (
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 border border-indigo-400/20">
                  Pinned
                </div>
              )}
            </div>
            {link ? (
              <>
                <div className="mt-2 text-sm font-semibold text-white leading-relaxed">
                  <button
                    onClick={() => props.onFocusNode(source)}
                    className="underline decoration-white/20 hover:decoration-white/60"
                    title="Focus this topic in the map"
                  >
                    {source}
                  </button>{' '}
                  <span className="text-gray-300">{direction}</span>{' '}
                  <button
                    onClick={() => props.onFocusNode(target)}
                    className="underline decoration-white/20 hover:decoration-white/60"
                    title="Focus this topic in the map"
                  >
                    {target}
                  </button>
                </div>
                {relationshipLabel && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-200">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                      {relationshipLabel}
                    </span>
                    {linkInsight && linkInsight.sharedNeighbors > 0 && (
                      <span className="rounded-full border border-slate-700/70 bg-black/20 px-2.5 py-1 text-slate-200">
                        Shared neighbors: {linkInsight.sharedNeighbors}
                      </span>
                    )}
                    {linkInsight?.isReciprocal && (
                      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-amber-100">
                        Mutual references
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 text-sm font-semibold text-white">
                Select a pinned connection.
              </div>
            )}
          </div>

          <div className={`flex gap-2 ${props.isTouchDevice ? 'w-full' : 'shrink-0'}`}>
            <button
              onClick={props.onPinToggle}
              className={`rounded-2xl bg-gray-800/70 hover:bg-gray-700/70 border border-gray-600/50 text-gray-200 text-xs ${props.isTouchDevice ? 'h-10 flex-1' : 'h-8 px-3'}`}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={props.onClose}
              className={`rounded-2xl bg-gray-800/70 hover:bg-gray-700/70 border border-gray-600/50 text-gray-200 text-xs flex items-center justify-center ${props.isTouchDevice ? 'h-10 flex-1' : 'h-8 w-8'}`}
              title="Close"
              aria-label="Close"
            >
              {props.isTouchDevice ? 'Close' : '×'}
            </button>
          </div>
        </div>

        <div className="mt-3 bg-black/30 rounded-2xl border border-gray-700/50 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-gray-400">
              Why These Topics Connect
            </div>
            {hasLongContext && !isLoading && (
              <button
                onClick={() => setShowFullContext(value => !value)}
                className="text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
              >
                {showFullContext ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {!link ? null : isLoading ? (
            <div className="animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-500/60 border-t-cyan-400/80 animate-spin" />
                <span className="text-[11px] text-gray-400">Loading snippet…</span>
              </div>
              <div className="space-y-2">
                <div className="h-2 rounded bg-gray-700/60 w-11/12" />
                <div className="h-2 rounded bg-gray-700/50 w-full" />
                <div className="h-2 rounded bg-gray-700/40 w-9/12" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {relationshipCopy && (
                <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-[11px] leading-relaxed text-slate-200">
                  {relationshipCopy}
                </div>
              )}
              <div className={`text-[12px] text-gray-200 leading-relaxed italic ${showFullContext ? '' : 'line-clamp-3'}`}>
                “{link?.context}”
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
