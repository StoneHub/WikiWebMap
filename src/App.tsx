import { useState, useEffect, useRef, useCallback, useReducer, type MouseEvent as ReactMouseEvent } from 'react';
import { GraphManager, Node as GraphNode, Link } from './GraphManager';
import { UpdateQueue } from './UpdateQueue';
import { WikiService } from './WikiService';
import './index.css';
import { SearchOverlay } from './components/SearchOverlay';
import { GraphControls } from './components/GraphControls';
import { NodeDetailsPanel } from './components/NodeDetailsPanel';
import { SearchStatusOverlay } from './components/SearchStatusOverlay';
import { LensingGridBackground } from './components/LensingGridBackground';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import type { SearchProgress } from './types/SearchProgress';
import { runPathfinder } from './features/pathfinding/runPathfinder';
import { SUGGESTED_PATHS, type SuggestedPath } from './data/suggestedPaths';
import LogPanel from './components/LogPanel';
import { connectionLogger } from './ConnectionLogger';
import { RecaptchaService } from './services/RecaptchaService';
import { clientErrorReporter } from './services/ClientErrorReporter';
import { useGraphState } from './hooks/useGraphState';
import { runtimeConfig } from './config/runtimeConfig';
import {
  DEFAULT_BRANCH_SPREAD,
  DEFAULT_SHOW_CROSS_LINKS,
  DEFAULT_TREE_SPACING,
  getDefaultLayoutMode,
  type LayoutMode,
} from './features/layout/layoutConfig';

type SearchJob = {
  id: string;
  from: string;
  to: string;
  source: 'suggested' | 'shift';
};

type PinnedAction =
  | { type: 'toggle'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'select'; id: string | null }
  | { type: 'clear' };

const createDefaultSearchProgress = (): SearchProgress => ({
  isSearching: false,
  isPaused: false,
  keepSearching: false,
  currentDepth: 0,
  maxDepth: 6,
  currentPage: '',
  exploredCount: 0,
  queueSize: 0,
  exploredNodes: new Set<string>(),
});

const WikiWebExplorer = () => {
  // --- Graph State Hook ---
  const {
    graphManagerRef,
    updateQueueRef,
    nodeCount, setNodeCount,
    linkCount, setLinkCount,
    userTypedNodes,
    autoDiscoveredNodes,
    expandedNodes,
    pathNodes, setPathNodes,
    recentlyAddedNodes,
    pathSelectedNodes, setPathSelectedNodes,
    bulkSelectedNodes, setBulkSelectedNodes,
    nodeThumbnails, setNodeThumbnails,
    nodeDescriptions, setNodeDescriptions,
    nodeCategories, setNodeCategories,
    nodeBacklinkCounts, setNodeBacklinkCounts,
    clickedNode, setClickedNode,
    clickedSummary, setClickedSummary,
    addTopic,
    expandNode,
    deleteNodeImperative,
    pruneGraph,
    pruneLeafNodes,
    pruneBranch,
    undo,
    redo,
    pushHistory,
  } = useGraphState();

  // --- Search & UI State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [featuredPaths, setFeaturedPaths] = useState<SuggestedPath[]>([]);
  const [showFeaturedPaths, setShowFeaturedPaths] = useState(true);

  // Link Context State
  const [, setActiveLinkContexts] = useState<Set<string>>(new Set());
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [pinnedState, dispatchPinned] = useReducer(
    (state: { ids: string[]; selectedId: string | null }, action: PinnedAction) => {
      switch (action.type) {
        case 'toggle': {
          const id = action.id;
          const exists = state.ids.includes(id);
          const ids = exists ? state.ids.filter(x => x !== id) : [...state.ids, id];
          const selectedId = exists
            ? (state.selectedId === id ? (ids.length > 0 ? ids[ids.length - 1] : null) : state.selectedId)
            : id;
          return { ids, selectedId };
        }
        case 'remove': {
          const id = action.id;
          const ids = state.ids.filter(x => x !== id);
          const selectedId = state.selectedId === id ? (ids.length > 0 ? ids[ids.length - 1] : null) : state.selectedId;
          return { ids, selectedId };
        }
        case 'select': {
          return { ...state, selectedId: action.id };
        }
        case 'clear': {
          return { ids: [], selectedId: null };
        }
        default:
          return state;
      }
    },
    { ids: [], selectedId: null }
  );
  const [, setLinkContextVersion] = useState(0);

  // Search Progress State
  const [searchProgress, setSearchProgress] = useState<SearchProgress>(createDefaultSearchProgress);
  const [searchLog, setSearchLog] = useState<string[]>([]);
  const [searchDockLinkId, setSearchDockLinkId] = useState<string | null>(null);
  const [searchDockPosition, setSearchDockPosition] = useState<{ x: number; y: number } | null>(null);
  const [foundPaths, setFoundPaths] = useState<Array<{ triggerLinkId: string; path: string[] }>>([]);
  const [keepSearching, setKeepSearching] = useState(false);
  const [searchQueue, setSearchQueue] = useState<SearchJob[]>([]);
  const searchQueueRef = useRef<SearchJob[]>([]);
  const [activeSearch, setActiveSearch] = useState<SearchJob | null>(null);
  const [searchTerminalMinimized, setSearchTerminalMinimized] = useState(false);
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [includeBacklinks, setIncludeBacklinks] = useState(() => {
    const raw = localStorage.getItem('wikiIncludeBacklinks');
    return raw === null ? true : raw === 'true';
  });
  const [apiContactEmail, setApiContactEmail] = useState(() => {
    const fromStorage = localStorage.getItem('wikiApiContactEmail') || '';
    const fromEnv = runtimeConfig.wikiApiContactEmail || '';
    return fromStorage || fromEnv;
  });

  // Visual settings
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    const stored = localStorage.getItem('wikiLayoutMode');
    if (stored === 'web' || stored === 'forest' || stored === 'structured') return stored;
    return getDefaultLayoutMode(import.meta.env.DEV);
  });
  const [nodeSpacing, setNodeSpacing] = useState(150);
  const [treeSpacing, setTreeSpacing] = useState(() => {
    const raw = Number(localStorage.getItem('wikiTreeSpacing'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TREE_SPACING;
  });
  const [branchSpread, setBranchSpread] = useState(() => {
    const raw = Number(localStorage.getItem('wikiBranchSpread'));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BRANCH_SPREAD;
  });
  const [showCrossLinks, setShowCrossLinks] = useState(() => {
    const raw = localStorage.getItem('wikiShowCrossLinks');
    return raw === null ? DEFAULT_SHOW_CROSS_LINKS : raw === 'true';
  });
  const [recursionDepth, setRecursionDepth] = useState(3);
  const [nodeSizeScale, setNodeSizeScale] = useState(1);

  // Refs needed for App logic
  const svgRef = useRef<SVGSVGElement>(null);
  const searchAbortRef = useRef(false);
  const searchPauseRef = useRef(false);
  const keepSearchingRef = useRef(false);
  const isRunningSearchRef = useRef(false);
  const pathSelectedNodesRef = useRef<GraphNode[]>([]);
  const animationFrameRef = useRef<number>();
  const searchDockLinkIdRef = useRef<string | null>(null);
  const searchDebounceTimeoutRef = useRef<number | null>(null);
  const refreshClickedNode = useCallback(() => {
    setClickedNode(prev => (prev ? { ...prev } : prev));
  }, [setClickedNode]);

  useEffect(() => {
    searchQueueRef.current = searchQueue;
  }, [searchQueue]);

  useEffect(() => {
    pathSelectedNodesRef.current = pathSelectedNodes;
  }, [pathSelectedNodes]);

  // --- Effects & Logic ---

  const shuffleFeaturedPaths = () => {
    const src = SUGGESTED_PATHS;
    if (src.length === 0) return;
    const picked: SuggestedPath[] = [];
    const used = new Set<number>();
    const count = Math.min(3, src.length);
    while (picked.length < count && used.size < src.length) {
      const idx = Math.floor(Math.random() * src.length);
      if (used.has(idx)) continue;
      used.add(idx);
      picked.push(src[idx]);
    }
    setFeaturedPaths(picked);
  };

  useEffect(() => {
    shuffleFeaturedPaths();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(pointer: coarse), (max-width: 640px)');
    const updateTouchMode = () => setIsTouchDevice(mediaQuery.matches);
    updateTouchMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateTouchMode);
      return () => mediaQuery.removeEventListener('change', updateTouchMode);
    }

    mediaQuery.addListener(updateTouchMode);
    return () => mediaQuery.removeListener(updateTouchMode);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable;
      if (isTyping) return;

      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      clientErrorReporter.report({
        source: 'window.error',
        message: event.message || 'Unhandled window error',
        detail: event.error?.name,
        stack: event.error?.stack,
        url: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error) {
        clientErrorReporter.report({
          source: 'unhandledrejection',
          message: reason.message,
          detail: reason.name,
          stack: reason.stack,
        });
        return;
      }

      clientErrorReporter.report({
        source: 'unhandledrejection',
        message: 'Unhandled promise rejection',
        detail: typeof reason === 'string' ? reason : JSON.stringify(reason),
      });
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    searchDockLinkIdRef.current = searchDockLinkId;
  }, [searchDockLinkId]);

  useEffect(() => {
    if (!isRunningSearchRef.current && searchQueueRef.current.length > 0) {
      const next = searchQueueRef.current[0];
      searchQueueRef.current = searchQueueRef.current.slice(1);
      setSearchQueue(searchQueueRef.current);
      runQueuedSearch(next);
    }
  }, [searchQueue]);

  // Debounced Search
  const debouncedSearch = useCallback((term: string) => {
    if (searchDebounceTimeoutRef.current) {
      clearTimeout(searchDebounceTimeoutRef.current);
    }
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchDebounceTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await WikiService.search(term);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 500);
  }, []);

  // Wrappers
  const handleAddTopic = (title: string) => {
    addTopic(title, includeBacklinks, setLoading, setError)
      .then(() => setSearchTerm(''))
      .catch(() => { }); // Error set in hook
  };

  const handleAddTopicFromSearchUI = (title: string) => {
    setShowFeaturedPaths(false);
    setShowSuggestions(false);
    handleAddTopic(title);
  };

  const handleExpandNode = (title: string) => {
    expandNode(title, includeBacklinks, setLoading, setError);
  };

  const handleDeleteNode = (nodeId: string) => {
    deleteNodeImperative(nodeId);
  };

  const handleDeleteSelection = () => {
    pruneGraph(setError);
    // Extra cleaner for App-local state
    setActiveLinkContexts(new Set());
    setSearchDockLinkId(null);
    setSearchDockPosition(null);
    dispatchPinned({ type: 'clear' });
  };

  const handleToggleNodePin = useCallback(() => {
    if (!clickedNode || !graphManagerRef.current) return;
    pushHistory();
    if (graphManagerRef.current.isNodePinned(clickedNode.id)) {
      graphManagerRef.current.unpinNode(clickedNode.id);
      setError(`Released "${clickedNode.title}" from its pinned position.`);
    } else {
      graphManagerRef.current.pinNode(clickedNode.id);
      setError(`Pinned "${clickedNode.title}" in place.`);
    }
    refreshClickedNode();
  }, [clickedNode, graphManagerRef, pushHistory, refreshClickedNode]);

  const clearFocusedNode = useCallback(() => {
    graphManagerRef.current?.highlightNode(null);
    setClickedNode(null);
    setClickedSummary('');
    setActiveLinkContexts(new Set());
    setHoveredLinkId(null);
  }, [graphManagerRef, setClickedNode, setClickedSummary]);

  const handleToggleBranchCollapse = useCallback(() => {
    if (!clickedNode || !graphManagerRef.current) return;
    pushHistory();
    const collapsed = graphManagerRef.current.toggleBranchCollapse(clickedNode.id);
    setError(
      collapsed
        ? `Collapsed the branch under "${clickedNode.title}".`
        : `Expanded the branch under "${clickedNode.title}".`
    );
    refreshClickedNode();
  }, [clickedNode, graphManagerRef, pushHistory, refreshClickedNode]);

  const handleRelayoutTree = useCallback(() => {
    if (!clickedNode || !graphManagerRef.current) return;
    pushHistory();
    graphManagerRef.current.resetTreeLayout(clickedNode.id);
    setError(`Reflowed the tree around "${clickedNode.title}".`);
    refreshClickedNode();
  }, [clickedNode, graphManagerRef, pushHistory, refreshClickedNode]);

  const handlePruneBranch = useCallback(() => {
    if (!clickedNode) return;
    pruneBranch(clickedNode.id, setError);
    setActiveLinkContexts(new Set());
    setSearchDockLinkId(null);
    setSearchDockPosition(null);
    dispatchPinned({ type: 'clear' });
    refreshClickedNode();
  }, [clickedNode, pruneBranch, refreshClickedNode]);

  const togglePathSelection = useCallback(async (node: GraphNode) => {
    const nextSelection = [...pathSelectedNodesRef.current];
    const existingIndex = nextSelection.findIndex(item => item.id === node.id);

    if (existingIndex >= 0) {
      nextSelection.splice(existingIndex, 1);
      setPathNodes(new Set());
      setError('');
    } else {
      nextSelection.push(node);
      if (nextSelection.length > 2) nextSelection.shift();
    }

    pathSelectedNodesRef.current = nextSelection;
    setPathSelectedNodes(nextSelection);

    if (nextSelection.length === 2) {
      const [startNode, endNode] = nextSelection;
      await enqueueSearch(startNode.id, endNode.id, 'shift');
      return;
    }

    setPathNodes(new Set());
    setError('');
  }, [setPathNodes, setPathSelectedNodes]);

  const openNodeDetails = useCallback(async (event: MouseEvent | ReactMouseEvent, d: GraphNode) => {
    if (event.defaultPrevented) return;
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}`, '_blank');
      return;
    }

    if (event.shiftKey) {
      await togglePathSelection(d);
      return;
    }

    if (graphManagerRef.current) graphManagerRef.current.highlightNode(d.id);

    setClickedNode(d);
    setClickedSummary('');
    const [result, categories, backlinks] = await Promise.all([
      WikiService.fetchSummary(d.title),
      WikiService.fetchCategories(d.title).catch(() => []),
      includeBacklinks ? WikiService.fetchBacklinks(d.title, 30) : Promise.resolve([]),
    ]);

    setClickedSummary(result.summary);
    if (result.thumbnail) setNodeThumbnails(prev => ({ ...prev, [d.title]: result.thumbnail! }));
    if (result.description) {
      setNodeDescriptions(prev => ({ ...prev, [d.title]: result.description! }));
      graphManagerRef.current?.setNodeMetadata(d.id, { colorSeed: result.description });
    }
    if (categories.length > 0) setNodeCategories(prev => ({ ...prev, [d.title]: categories }));
    if (includeBacklinks) setNodeBacklinkCounts(prev => ({ ...prev, [d.title]: backlinks.length }));
  }, [
    graphManagerRef,
    includeBacklinks,
    setClickedNode,
    setClickedSummary,
    setNodeBacklinkCounts,
    setNodeCategories,
    setNodeDescriptions,
    setNodeThumbnails,
    togglePathSelection,
  ]);

  // Initialization
  useEffect(() => {
    if (!svgRef.current || graphManagerRef.current) return;

    graphManagerRef.current = new GraphManager(svgRef.current, {
      onNodeClick: (node, event) => { void openNodeDetails(event as any, node); },
      onNodeDoubleClick: (node, event) => {
        event.stopPropagation();
        handleExpandNode(node.id);
      },
      onLinkClick: (link, event) => {
        event.stopPropagation();
        if (!link.id) return;
        dispatchPinned({ type: 'toggle', id: link.id });
        setActiveLinkContexts(prev => {
          const next = new Set(prev);
          if (next.has(link.id!)) next.delete(link.id!);
          else next.add(link.id!);
          return next;
        });
      },
      onLinkHover: (link) => setHoveredLinkId(link.id),
      onLinkHoverEnd: (link) => setHoveredLinkId(prev => (prev === link.id ? null : prev)),
      onBackgroundClick: () => {
        clearFocusedNode();
      },
      onSelectionChange: (nodes) => setBulkSelectedNodes(nodes),
      onLinksApplied: ({ added, updated }) => {
        const normalize = (l: Link) => {
          const source = typeof l.source === 'object' ? l.source.id : l.source;
          const target = typeof l.target === 'object' ? l.target.id : l.target;
          return { source, target, type: (l.type || 'auto') as any };
        };
        [...added, ...updated].forEach(l => {
          const { source, target, type } = normalize(l);
          connectionLogger.log(source, target, type);
        });
        if (added.length > 0 || updated.length > 0) setLinkContextVersion(v => v + 1);
      },
      onStatsUpdate: (stats) => {
        setNodeCount(stats.nodeCount);
        setLinkCount(stats.linkCount);
      },
    });

    graphManagerRef.current.setLayoutMode(layoutMode);
    graphManagerRef.current.setTreeSpacing(treeSpacing);
    graphManagerRef.current.setBranchSpread(branchSpread);
    graphManagerRef.current.setShowCrossLinks(showCrossLinks);

    updateQueueRef.current = new UpdateQueue(graphManagerRef.current, 500);

    const trackDock = () => {
      const dockLinkId = searchDockLinkIdRef.current;
      if (dockLinkId && graphManagerRef.current) {
        const pos = graphManagerRef.current.getLinkScreenCoordinates(dockLinkId);
        if (pos) setSearchDockPosition(pos);
      }
      animationFrameRef.current = requestAnimationFrame(trackDock);
    };
    trackDock();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (graphManagerRef.current) {
        graphManagerRef.current.destroy();
        graphManagerRef.current = null;
      }
      if (updateQueueRef.current) {
        updateQueueRef.current.destroy();
        updateQueueRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const svg = svgRef.current;
      const gm = graphManagerRef.current;
      if (!svg || !gm) return;
      const rect = svg.getBoundingClientRect();
      gm.resize(rect.width, rect.height);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (graphManagerRef.current) graphManagerRef.current.setLayoutMode(layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    if (graphManagerRef.current) graphManagerRef.current.setNodeSpacing(nodeSpacing);
  }, [nodeSpacing]);

  useEffect(() => {
    if (graphManagerRef.current) graphManagerRef.current.setTreeSpacing(treeSpacing);
  }, [treeSpacing]);

  useEffect(() => {
    if (graphManagerRef.current) graphManagerRef.current.setBranchSpread(branchSpread);
  }, [branchSpread]);

  useEffect(() => {
    if (graphManagerRef.current) graphManagerRef.current.setShowCrossLinks(showCrossLinks);
  }, [showCrossLinks]);

  useEffect(() => {
    if (graphManagerRef.current) graphManagerRef.current.setNodeSizeScale(nodeSizeScale);
  }, [nodeSizeScale]);

  useEffect(() => {
    const trimmed = apiContactEmail.trim();
    if (trimmed) localStorage.setItem('wikiApiContactEmail', trimmed);
    else localStorage.removeItem('wikiApiContactEmail');
    const apiUserAgent = trimmed
      ? (trimmed.includes('/') || trimmed.includes('(') ? trimmed : `WikiWebMap (${trimmed})`)
      : undefined;
    WikiService.setApiUserAgent(apiUserAgent);
  }, [apiContactEmail]);

  useEffect(() => {
    localStorage.setItem('wikiIncludeBacklinks', includeBacklinks ? 'true' : 'false');
  }, [includeBacklinks]);

  useEffect(() => {
    localStorage.setItem('wikiLayoutMode', layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    localStorage.setItem('wikiTreeSpacing', String(treeSpacing));
  }, [treeSpacing]);

  useEffect(() => {
    localStorage.setItem('wikiBranchSpread', String(branchSpread));
  }, [branchSpread]);

  useEffect(() => {
    localStorage.setItem('wikiShowCrossLinks', showCrossLinks ? 'true' : 'false');
  }, [showCrossLinks]);

  // Sync Metadata
  useEffect(() => {
    if (!graphManagerRef.current) return;
    const selectedNodeIds = new Set<string>([
      ...pathSelectedNodes.map(n => n.id),
      ...bulkSelectedNodes.map(n => n.id),
    ]);
    const updates = Array.from(
      new Set([
        ...userTypedNodes,
        ...autoDiscoveredNodes,
        ...expandedNodes,
        ...pathNodes,
        ...recentlyAddedNodes,
        ...selectedNodeIds,
      ])
    ).map(nodeId => ({
      nodeId,
      metadata: {
        isUserTyped: userTypedNodes.has(nodeId),
        isAutoDiscovered: autoDiscoveredNodes.has(nodeId),
        isExpanded: expandedNodes.has(nodeId),
        isInPath: pathNodes.has(nodeId),
        isRecentlyAdded: recentlyAddedNodes.has(nodeId),
        isSelected: selectedNodeIds.has(nodeId),
        isPathEndpoint: pathSelectedNodes.some(n => n.id === nodeId),
        isBulkSelected: bulkSelectedNodes.some(n => n.id === nodeId),
        isCurrentlyExploring: searchProgress.currentPage === nodeId && searchProgress.isSearching,
        thumbnail: nodeThumbnails[nodeId],
      },
    }));

    if (updates.length > 0) {
      graphManagerRef.current.setNodesMetadata(updates);
    }
  }, [
    userTypedNodes, autoDiscoveredNodes, expandedNodes, pathNodes, recentlyAddedNodes,
    pathSelectedNodes, bulkSelectedNodes, searchProgress.currentPage, searchProgress.isSearching,
    nodeThumbnails,
  ]);

  // Path highlight sync
  useEffect(() => {
    graphManagerRef.current?.setPathHighlight(pathNodes.size > 0 ? pathNodes : null);
  }, [pathNodes]);

  // Search Logic (kept in App for now, but uses hook wrapper)
  const cancelSearch = () => {
    searchAbortRef.current = true;
    searchPauseRef.current = false;
    searchQueueRef.current = [];
    setSearchQueue([]);
    setSearchDockLinkId(null);
    setSearchDockPosition(null);
    setSearchProgress(prev => ({ ...prev, isPaused: false, queueSize: 0 }));
    setError('Stopping search. Keeping the current map and topics in place.');
    setSearchLog(prev => [
      ...prev,
      '[USER] Stop command received. Preserving the current map and clearing queued searches.',
    ].slice(-8));
  };

  const pauseSearch = () => {
    searchPauseRef.current = true;
    setSearchProgress(prev => ({ ...prev, isPaused: true }));
    setSearchLog(prev => [...prev, `[USER] Pause command received.`]);
  };

  const resumeSearch = () => {
    searchPauseRef.current = false;
    setSearchProgress(prev => ({ ...prev, isPaused: false }));
    setSearchLog(prev => [...prev, `[USER] Resume command received.`]);
  };

  useEffect(() => {
    setSearchProgress(prev => ({ ...prev, keepSearching }));
    keepSearchingRef.current = keepSearching;
  }, [keepSearching]);

  const findPath = (startInput: string, endInput: string) =>
    runPathfinder({
      startInput,
      endInput,
      maxDepth: recursionDepth * 2,
      keepSearchingRef,
      graphManagerRef,
      searchAbortRef,
      searchPauseRef,
      setLoading,
      setSearchLog,
      setSearchProgress,
      setPathNodes,
      setError,
      setPathSelectedNodes,
      onFoundPath: (found) => {
        setFoundPaths(prev => [...prev, found]);
        setSearchDockLinkId(prev => prev ?? found.triggerLinkId);
      },
    });

  const enqueueSearch = async (from: string, to: string, source: 'suggested' | 'shift') => {
    const passedVerification = await RecaptchaService.verify('pathfinding');
    if (!passedVerification) {
      setError('Bot verification failed. Please try again.');
      return;
    }
    setSearchQueue(prev => {
      if (prev.length >= 3 || searchQueueRef.current.length >= 3) {
        setError('Search queue full (max 3).');
        return prev;
      }
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const next = [...prev, { id, from, to, source }];
      searchQueueRef.current = next;
      setSearchTerminalMinimized(false);
      return next;
    });
  };

  const removeQueuedSearch = (id: string) => {
    setSearchQueue(prev => {
      const next = prev.filter(item => item.id !== id);
      searchQueueRef.current = next;
      return next;
    });
  };

  const runQueuedSearch = async (job: SearchJob) => {
    isRunningSearchRef.current = true;
    setActiveSearch(job);
    setSearchTerminalMinimized(false);
    searchAbortRef.current = false;
    searchPauseRef.current = false;
    setFoundPaths([]);
    setSearchDockLinkId(null);
    setSearchDockPosition(null);
    dispatchPinned({ type: 'clear' });

    try {
      if (job.source === 'suggested') {
        pushHistory();
        setShowFeaturedPaths(false);
        setShowSuggestions(false);
        setSearchTerm(`${job.from} → ${job.to}`);
        setSearchLog([`[QUEUE] Exploring a bridge between "${job.from}" and "${job.to}" on the current map...`]);
        setSearchProgress(prev => ({ ...prev, isSearching: true, isPaused: false }));
      } else {
        setSearchLog([`[QUEUE] Searching path: ${job.from} → ${job.to}`]);
      }

      // We need addTopic to return the title, but hook version returns promise<string>.
      const [startTitle, endTitle] = await Promise.all([
        addTopic(job.from, true, undefined, undefined),
        addTopic(job.to, true, undefined, undefined)
      ]);
      if (searchAbortRef.current) {
        return;
      }
      setSearchLog(prev => [...prev, `[QUEUE] Launching pathfinder...`].slice(-8));
      if (job.source === 'shift') {
        pushHistory();
      }
      const result = await findPath(startTitle || job.from, endTitle || job.to);
      if (result.status === 'aborted') {
        setError('Search stopped. Kept the topics already visible on the map.');
      } else if (result.status === 'not_found') {
        setError('No complete path found yet. The explored topics stayed on the map so you can keep exploring from here.');
      }
    } catch (err: any) {
      clientErrorReporter.reportError(err, 'Queued path search failed');
      setError(err?.message || 'Error during queued search');
    } finally {
      setSearchProgress(prev => ({
        ...prev,
        isSearching: false,
        isPaused: false,
        queueSize: searchQueueRef.current.length,
      }));
      isRunningSearchRef.current = false;
      setActiveSearch(null);
      if (!searchAbortRef.current && searchQueueRef.current.length > 0) {
        const next = searchQueueRef.current[0];
        searchQueueRef.current = searchQueueRef.current.slice(1);
        setSearchQueue(searchQueueRef.current);
        void runQueuedSearch(next);
      }
    }
  };

  const runSuggestedPath = async (from: string, to: string) => {
    await enqueueSearch(from, to, 'suggested');
  };

  const displayedLinkId =
    pinnedState.selectedId ||
    hoveredLinkId ||
    (pinnedState.ids.length > 0 ? pinnedState.ids[pinnedState.ids.length - 1] : null);
  const displayedLink = displayedLinkId ? graphManagerRef.current?.getLinkById(displayedLinkId) || null : null;
  const pinnedLinks = pinnedState.ids
    .map(id => graphManagerRef.current?.getLinkById(id))
    .filter((x): x is Link => Boolean(x));
  const clickedNodeMeta = clickedNode
    ? graphManagerRef.current?.getNodeMetadata(clickedNode.id)
    : undefined;
  const mobileSearchDockMode = !isTouchDevice
    ? 'none'
    : searchProgress.isSearching && !searchTerminalMinimized
      ? 'sheet'
      : (searchTerminalMinimized || keepSearching || searchQueue.length > 0 || Boolean(activeSearch))
        ? 'bar'
        : 'none';

  useEffect(() => {
    if (!displayedLinkId || !graphManagerRef.current) return;
    const link = graphManagerRef.current.getLinkById(displayedLinkId);
    if (!link || link.context) return;
    const source = typeof link.source === 'object' ? link.source.id : link.source;
    const target = typeof link.target === 'object' ? link.target.id : link.target;

    const handle = window.setTimeout(() => {
      void WikiService.fetchLinkContext(source, target).then((context) => {
        const nextContext = context || `Snippet unavailable. Connection confirmed because “${source}” contains a link to “${target}”.`;
        graphManagerRef.current?.addLinks([{
          source,
          target,
          id: displayedLinkId,
          type: link.type,
          context: nextContext,
        }]);
      });
    }, pinnedState.selectedId ? 0 : 280);

    return () => window.clearTimeout(handle);
  }, [displayedLinkId, pinnedState.selectedId, graphManagerRef]);

  return (
    <div className="w-screen h-screen bg-gray-900 text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <LensingGridBackground graphManagerRef={graphManagerRef} layoutMode={layoutMode} />
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      <SearchOverlay
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        hasGraphContent={nodeCount > 0}
        isTouchDevice={isTouchDevice}
        loading={loading}
        error={error}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        featuredPaths={featuredPaths}
        onShuffleFeaturedPaths={shuffleFeaturedPaths}
        showFeaturedPaths={showFeaturedPaths}
        onFocusSearch={() => setShowFeaturedPaths(true)}
        onBlurSearch={() => setShowFeaturedPaths(false)}
        onSearchChange={(e) => {
          const term = e.target.value;
          setSearchTerm(term);
          debouncedSearch(term);
        }}
        onAddTopic={handleAddTopicFromSearchUI}
        onRunSuggestedPath={runSuggestedPath}
      />

      <GraphControls
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        nodeSpacing={nodeSpacing}
        setNodeSpacing={setNodeSpacing}
        treeSpacing={treeSpacing}
        setTreeSpacing={setTreeSpacing}
        branchSpread={branchSpread}
        setBranchSpread={setBranchSpread}
        showCrossLinks={showCrossLinks}
        setShowCrossLinks={setShowCrossLinks}
        recursionDepth={recursionDepth}
        setRecursionDepth={setRecursionDepth}
        nodeSizeScale={nodeSizeScale}
        setNodeSizeScale={setNodeSizeScale}
        includeBacklinks={includeBacklinks}
        setIncludeBacklinks={setIncludeBacklinks}
        apiContactEmail={apiContactEmail}
        setApiContactEmail={setApiContactEmail}
        nodeCount={nodeCount}
        linkCount={linkCount}
        canPruneLeaves={nodeCount > 0}
        canDeleteSelection={bulkSelectedNodes.length > 0}
        isTouchDevice={isTouchDevice}
        mobileDockMode={mobileSearchDockMode}
        onPruneLeaves={() => pruneLeafNodes(setError)}
        onDeleteSelection={handleDeleteSelection}
        onOpenLogs={() => setLogPanelOpen(true)}
      />

      <SearchStatusOverlay
        searchProgress={searchProgress}
        searchLog={searchLog}
        nodeCount={nodeCount}
        linkCount={linkCount}
        onCancelSearch={cancelSearch}
        onPauseSearch={pauseSearch}
        onResumeSearch={resumeSearch}
        dockPosition={searchDockPosition || undefined}
        isDocked={Boolean(searchDockLinkId && searchDockPosition)}
        keepSearching={keepSearching}
        onToggleKeepSearching={() => setKeepSearching(v => !v)}
        foundCount={foundPaths.length}
        queue={searchQueue}
        activeSearch={activeSearch}
        onDeleteQueued={removeQueuedSearch}
        isMinimized={searchTerminalMinimized}
        onToggleMinimize={() => setSearchTerminalMinimized(v => !v)}
        persistentVisible={keepSearching || searchQueue.length > 0 || Boolean(activeSearch)}
        isTouchDevice={isTouchDevice}
        onOpenLogs={() => setLogPanelOpen(true)}
      />

      <NodeDetailsPanel
        clickedNode={clickedNode}
        clickedSummary={clickedSummary}
        clickedDescription={clickedNode ? nodeDescriptions[clickedNode.title] : undefined}
        clickedCategories={clickedNode ? nodeCategories[clickedNode.title] : undefined}
        clickedBacklinkCount={clickedNode ? nodeBacklinkCounts[clickedNode.title] : undefined}
        nodeThumbnails={nodeThumbnails}
        layoutMode={layoutMode}
        isPinned={Boolean(clickedNodeMeta?.isPinned)}
        isBranchCollapsed={Boolean(clickedNodeMeta?.isCollapsed)}
        isPathSelected={Boolean(clickedNode && pathSelectedNodes.some(node => node.id === clickedNode.id))}
        pathSelectionCount={pathSelectedNodes.length}
        onClose={clearFocusedNode}
        onExpand={handleExpandNode}
        onTogglePathSelection={() => {
          if (!clickedNode) return Promise.resolve();
          return togglePathSelection(clickedNode);
        }}
        onTogglePin={handleToggleNodePin}
        onToggleBranchCollapse={handleToggleBranchCollapse}
        onPruneBranch={handlePruneBranch}
        onRelayoutTree={handleRelayoutTree}
        onDelete={handleDeleteNode}
      />

      <LogPanel isOpen={logPanelOpen} onClose={() => setLogPanelOpen(false)} />

      <ConnectionStatusBar
        link={displayedLink}
        pinnedLinks={pinnedLinks}
        selectedPinnedLinkId={pinnedState.selectedId}
        isTouchDevice={isTouchDevice}
        onSelectPinned={(linkId) => dispatchPinned({ type: 'select', id: linkId })}
        onRemovePinned={(linkId) => dispatchPinned({ type: 'remove', id: linkId })}
        onPinToggle={() => {
          if (!displayedLinkId) return;
          dispatchPinned({ type: 'toggle', id: displayedLinkId });
        }}
        onFocusNode={(nodeId) => {
          const gm = graphManagerRef.current;
          if (!gm) return;
          gm.highlightNode(nodeId);
          gm.centerOnNode(nodeId);
        }}
        onClose={() => {
          dispatchPinned({ type: 'select', id: null });
          setHoveredLinkId(null);
        }}
      />
    </div>
  );
};

export default WikiWebExplorer;
