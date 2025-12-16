import type { Link } from '../GraphManager';

export function ConnectionStatusBar(props: {
  link: Link | null;
  pinnedLinks: Link[];
  selectedPinnedLinkId: string | null;
  onSelectPinned: (linkId: string) => void;
  onRemovePinned: (linkId: string) => void;
  onPinToggle: () => void;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
}) {
  const link = props.link;
  if (!link && props.pinnedLinks.length === 0) {
    return (
      <div className="fixed left-1/2 bottom-3 -translate-x-1/2 z-40 pointer-events-none">
        <div className="pointer-events-none bg-gray-900/70 backdrop-blur-md border border-gray-700/60 rounded-2xl shadow-2xl px-4 py-2 text-[11px] text-gray-300">
          Hover a connection line for context. Click a line to pin it.
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

  return (
    <div className="fixed left-1/2 bottom-3 -translate-x-1/2 z-40 w-[min(720px,calc(100vw-1.5rem))] pointer-events-none">
      <div className="pointer-events-auto bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-2xl shadow-2xl px-4 py-3">
        {props.pinnedLinks.length > 0 && (
          <div className="mb-2 flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700/80 scrollbar-track-transparent">
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

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-widest text-cyan-300/90 font-bold">
                Connection
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
              <div className="mt-1 text-sm font-semibold text-white truncate">
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
            ) : (
              <div className="mt-1 text-sm font-semibold text-white">
                Select a pinned connection.
              </div>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={props.onPinToggle}
              className="h-8 px-3 rounded-xl bg-gray-800/70 hover:bg-gray-700/70 border border-gray-600/50 text-gray-200 text-xs"
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={props.onClose}
              className="h-8 w-8 rounded-xl bg-gray-800/70 hover:bg-gray-700/70 border border-gray-600/50 text-gray-200 text-xs flex items-center justify-center"
              title="Close"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="mt-2 bg-black/30 rounded-xl border border-gray-700/50 px-3 py-2">
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
            <div className="text-[12px] text-gray-200 leading-relaxed line-clamp-3 italic">
              “{link?.context}”
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
