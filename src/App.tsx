import { useState, useEffect, useRef, useCallback } from 'react';
import { GraphManager, Node as GraphNode, Link, GraphStateSnapshot } from './GraphManager';
import { UpdateQueue } from './UpdateQueue';
import { WikiService, LinkWithContext } from './WikiService';
import './index.css';
import { SearchOverlay } from './components/SearchOverlay';
import { GraphControls } from './components/GraphControls';
import { NodeDetailsPanel } from './components/NodeDetailsPanel';
import { LinkContextsLayer } from './components/LinkContextsLayer';
import { SearchStatusOverlay } from './components/SearchStatusOverlay';
import { LensingGridBackground } from './components/LensingGridBackground';
import type { SearchProgress } from './types/SearchProgress';
import { runPathfinder } from './features/pathfinding/runPathfinder';
import { SUGGESTED_PATHS, type SuggestedPath } from './data/suggestedPaths';
import LogPanel from './components/LogPanel';
import { connectionLogger } from './ConnectionLogger';
import { RecaptchaService } from './services/RecaptchaService';

const WikiWebExplorer = () => {
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [linkCount, setLinkCount] = useState<number>(0);
  const [clickedNode, setClickedNode] = useState<GraphNode | null>(null);
  const [clickedSummary, setClickedSummary] = useState('');
  const [pathSelectedNodes, setPathSelectedNodes] = useState<GraphNode[]>([]);
  const [bulkSelectedNodes, setBulkSelectedNodes] = useState<GraphNode[]>([]);
  const [pathNodes, setPathNodes] = useState(new Set<string>());
  const [userTypedNodes, setUserTypedNodes] = useState(new Set<string>());
  const [autoDiscoveredNodes, setAutoDiscoveredNodes] = useState(new Set<string>());
  const [recentlyAddedNodes] = useState(new Set<string>());
  const [expandedNodes, setExpandedNodes] = useState(new Set<string>());
  const [nodeThumbnails, setNodeThumbnails] = useState<Record<string, string>>({});
  const [nodeDescriptions, setNodeDescriptions] = useState<Record<string, string>>({});
  const [nodeCategories, setNodeCategories] = useState<Record<string, string[]>>({});
  const [nodeBacklinkCounts, setNodeBacklinkCounts] = useState<Record<string, number>>({});
  const [featuredPaths, setFeaturedPaths] = useState<SuggestedPath[]>([]);
  const [showFeaturedPaths, setShowFeaturedPaths] = useState(true);

  // Link Context State
  const [activeLinkContexts, setActiveLinkContexts] = useState<Set<string>>(new Set());
  const [linkContextPositions, setLinkContextPositions] = useState<Record<string, { x: number, y: number }>>({});

  // Search Progress State
  const [searchProgress, setSearchProgress] = useState<SearchProgress>({
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
  const [searchLog, setSearchLog] = useState<string[]>([]); // Granular log
  const [searchDockLinkId, setSearchDockLinkId] = useState<string | null>(null);
  const [searchDockPosition, setSearchDockPosition] = useState<{ x: number; y: number } | null>(null);
  const [foundPaths, setFoundPaths] = useState<Array<{ triggerLinkId: string; path: string[] }>>([]);
  const [keepSearching, setKeepSearching] = useState(false);
  const [searchQueue, setSearchQueue] = useState<Array<{ id: string; from: string; to: string; source: 'suggested' | 'shift' }>>([]);
  const searchQueueRef = useRef<Array<{ id: string; from: string; to: string; source: 'suggested' | 'shift' }>>([]);
  const [activeSearch, setActiveSearch] = useState<{ id: string; from: string; to: string; source: 'suggested' | 'shift' } | null>(null);
  const [searchTerminalMinimized, setSearchTerminalMinimized] = useState(false);
  const [logPanelOpen, setLogPanelOpen] = useState(false);

  // Settings Visibility
  const [showSettings, setShowSettings] = useState(false);
  const [includeBacklinks, setIncludeBacklinks] = useState(() => {
    const raw = localStorage.getItem('wikiIncludeBacklinks');
    return raw === null ? true : raw === 'true';
  });
  const [apiContactEmail, setApiContactEmail] = useState(() => {
    const fromStorage = localStorage.getItem('wikiApiContactEmail') || '';
    const fromEnv = (import.meta.env.VITE_WIKI_API_CONTACT_EMAIL as string | undefined) || '';
    return fromStorage || fromEnv;
  });

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const graphManagerRef = useRef<GraphManager | null>(null);
  const updateQueueRef = useRef<UpdateQueue | null>(null);
  const searchAbortRef = useRef(false);
  const searchPauseRef = useRef(false);
  const keepSearchingRef = useRef(false);
  const isRunningSearchRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const activeLinkContextsRef = useRef<Set<string>>(new Set());
  const linkContextPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const searchDockLinkIdRef = useRef<string | null>(null);
  const mutationEpochRef = useRef(0);
  const searchDebounceTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    searchQueueRef.current = searchQueue;
  }, [searchQueue]);

  type AppSnapshot = {
    graph: GraphStateSnapshot;
    userTypedNodes: string[];
    autoDiscoveredNodes: string[];
    expandedNodes: string[];
    pathNodes: string[];
    nodeThumbnails: Record<string, string>;
  };

  const undoStackRef = useRef<AppSnapshot[]>([]);
  const redoStackRef = useRef<AppSnapshot[]>([]);
  const suppressHistoryRef = useRef(false);
  const MAX_HISTORY = 30;

  const createSnapshot = (): AppSnapshot | null => {
    if (!graphManagerRef.current) return null;
    return {
      graph: graphManagerRef.current.getStateSnapshot(),
      userTypedNodes: Array.from(userTypedNodes),
      autoDiscoveredNodes: Array.from(autoDiscoveredNodes),
      expandedNodes: Array.from(expandedNodes),
      pathNodes: Array.from(pathNodes),
      nodeThumbnails: { ...nodeThumbnails },
    };
  };

  const restoreSnapshot = (snap: AppSnapshot) => {
    if (!graphManagerRef.current) return;

    // Invalidate in-flight async mutations (add/expand/etc).
    mutationEpochRef.current++;
    updateQueueRef.current?.clear();

    // Stop search UX.
    searchAbortRef.current = true;
    searchPauseRef.current = false;
    setSearchProgress(prev => ({ ...prev, isSearching: false, isPaused: false }));
    setSearchDockLinkId(null);
    setSearchDockPosition(null);
    setFoundPaths([]);
    setSearchLog([]);

    setActiveLinkContexts(new Set());

    graphManagerRef.current.setStateSnapshot(snap.graph);

    setUserTypedNodes(new Set(snap.userTypedNodes));
    setAutoDiscoveredNodes(new Set(snap.autoDiscoveredNodes));
    setExpandedNodes(new Set(snap.expandedNodes));
    setPathNodes(new Set(snap.pathNodes));
    setNodeThumbnails(snap.nodeThumbnails);

    setBulkSelectedNodes([]);
    setPathSelectedNodes([]);
    setClickedNode(null);
    setClickedSummary('');
    setError('');
  };

  const pushHistory = () => {
    if (suppressHistoryRef.current) return;
    const snap = createSnapshot();
    if (!snap) return;
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    redoStackRef.current = [];
  };

  const undo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    const current = createSnapshot();
    if (current) redoStackRef.current.push(current);
    restoreSnapshot(prev);
  };

  const redo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    const current = createSnapshot();
    if (current) undoStackRef.current.push(current);
    restoreSnapshot(next);
  };

  // Visual settings
  const [nodeSpacing, setNodeSpacing] = useState(150);
  const [recursionDepth, setRecursionDepth] = useState(3);
  const [nodeSizeScale, setNodeSizeScale] = useState(1);

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
  }, []);

  useEffect(() => {
    activeLinkContextsRef.current = activeLinkContexts;
  }, [activeLinkContexts]);

  useEffect(() => {
    linkContextPositionsRef.current = linkContextPositions;
  }, [linkContextPositions]);

  useEffect(() => {
    searchDockLinkIdRef.current = searchDockLinkId;
  }, [searchDockLinkId]);

  useEffect(() => {
    // Kick off next queued search when idle
    if (!isRunningSearchRef.current && searchQueueRef.current.length > 0) {
      const next = searchQueueRef.current[0];
      searchQueueRef.current = searchQueueRef.current.slice(1);
      setSearchQueue(searchQueueRef.current);
      runQueuedSearch(next);
    }
  }, [searchQueue]);

  // Initialize GraphManager
  useEffect(() => {
    if (!svgRef.current || graphManagerRef.current) return;

    graphManagerRef.current = new GraphManager(svgRef.current, {
      onNodeClick: (node, event) => handleNodeClick(event as any, node),
      onNodeDoubleClick: (node, event) => handleNodeDoubleClick(event as any, node),
      onLinkClick: (link, event) => handleLinkClick(event as any, link),
      onBackgroundClick: () => {
        graphManagerRef.current?.highlightNode(null);
        setClickedNode(null);
      },
      onSelectionChange: (nodes) => setBulkSelectedNodes(nodes),
      onLinksApplied: ({ added, updated }) => {
        const normalize = (l: Link) => {
          const source = typeof l.source === 'object' ? l.source.id : l.source;
          const target = typeof l.target === 'object' ? l.target.id : l.target;
          return { source, target, type: (l.type || 'auto') as any };
        };

        added.forEach(l => {
          const { source, target, type } = normalize(l);
          connectionLogger.log(source, target, type);
        });
        updated.forEach(l => {
          const { source, target } = normalize(l);
          connectionLogger.log(source, target, 'path');
        });
      },
      onStatsUpdate: (stats) => {
        setNodeCount(stats.nodeCount);
        setLinkCount(stats.linkCount);
      },
    });

    updateQueueRef.current = new UpdateQueue(graphManagerRef.current, 500);

    // Start tracking loop for link popups + docked search dialog
    const trackPopups = () => {
      const activeIds = activeLinkContextsRef.current;
      const dockLinkId = searchDockLinkIdRef.current;

      if ((activeIds.size > 0 || dockLinkId) && graphManagerRef.current) {
        const newPositions: Record<string, { x: number, y: number }> = {};
        let hasChanges = false;

        activeIds.forEach(linkId => {
          const pos = graphManagerRef.current!.getLinkScreenCoordinates(linkId);
          if (pos) {
            newPositions[linkId] = pos;
            if (
              !linkContextPositionsRef.current[linkId] ||
              Math.abs(linkContextPositionsRef.current[linkId].x - pos.x) > 1 ||
              Math.abs(linkContextPositionsRef.current[linkId].y - pos.y) > 1
            ) {
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          setLinkContextPositions(prev => {
            const next = { ...prev, ...newPositions };
            linkContextPositionsRef.current = next;
            return next;
          });
        }

        if (dockLinkId) {
          const pos = graphManagerRef.current!.getLinkScreenCoordinates(dockLinkId);
          if (pos) setSearchDockPosition(pos);
        }
      }
      animationFrameRef.current = requestAnimationFrame(trackPopups);
    };
    trackPopups();

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
  }, []); // Initialize once; tracking uses refs

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

  // Sync settings
  useEffect(() => {
    if (graphManagerRef.current) {
      graphManagerRef.current.setNodeSpacing(nodeSpacing);
    }
  }, [nodeSpacing]);

  useEffect(() => {
    if (graphManagerRef.current) {
      graphManagerRef.current.setNodeSizeScale(nodeSizeScale);
    }
  }, [nodeSizeScale]);

  useEffect(() => {
    const trimmed = apiContactEmail.trim();
    if (trimmed) localStorage.setItem('wikiApiContactEmail', trimmed);
    else localStorage.removeItem('wikiApiContactEmail');

    WikiService.setApiUserAgent(trimmed ? `WikiWebMap (${trimmed})` : undefined);
  }, [apiContactEmail]);

  useEffect(() => {
    localStorage.setItem('wikiIncludeBacklinks', includeBacklinks ? 'true' : 'false');
  }, [includeBacklinks]);

  // Sync node metadata
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
    userTypedNodes,
    autoDiscoveredNodes,
    expandedNodes,
    pathNodes,
    recentlyAddedNodes,
    pathSelectedNodes,
    bulkSelectedNodes,
    searchProgress.currentPage,
    searchProgress.isSearching,
    nodeThumbnails,
  ]);

  // -- Debounced Search Handler --
  const debouncedSearch = useCallback((term: string) => {
    // Clear any existing timeout
    if (searchDebounceTimeoutRef.current) {
      clearTimeout(searchDebounceTimeoutRef.current);
    }

    // If term is too short, clear suggestions immediately
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Set a new timeout for the search (500ms debounce)
    searchDebounceTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await WikiService.search(term);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Search failed:', err);
        setSuggestions([]);
      }
    }, 500);
  }, []);

  // -- Actions --

  const addTopic = async (title: string, silent = false) => {
    if (!title.trim()) {
      setError('Please enter a topic');
      return;
    }

    if (!updateQueueRef.current) return;

    if (!silent) setLoading(true);
    setError('');

    const epoch = mutationEpochRef.current;

    try {
      const resolvedTitle = await WikiService.resolveTitle(title);
      const [links, summaryData, categories, backlinks] = await Promise.all([
        WikiService.fetchLinks(resolvedTitle),
        WikiService.fetchSummary(resolvedTitle),
        WikiService.fetchCategories(resolvedTitle).catch(() => []),
        includeBacklinks ? WikiService.fetchBacklinks(resolvedTitle, 25) : Promise.resolve([]),
      ]);

      if (epoch !== mutationEpochRef.current) return resolvedTitle;
      pushHistory();

      if (summaryData.thumbnail) {
        setNodeThumbnails(prev => ({ ...prev, [resolvedTitle]: summaryData.thumbnail! }));
      }
      if (summaryData.description) {
        setNodeDescriptions(prev => ({ ...prev, [resolvedTitle]: summaryData.description! }));
        graphManagerRef.current?.setNodeMetadata(resolvedTitle, { colorSeed: summaryData.description });
      }
      if (categories.length > 0) {
        setNodeCategories(prev => ({ ...prev, [resolvedTitle]: categories }));
      }
      if (includeBacklinks) {
        setNodeBacklinkCounts(prev => ({ ...prev, [resolvedTitle]: backlinks.length }));
      }

      setUserTypedNodes(prev => new Set([...prev, resolvedTitle]));

      const newNodes: GraphNode[] = [{ id: resolvedTitle, title: resolvedTitle }];
      const newLinks: Link[] = [];
      const newAutoDiscovered = new Set<string>();

      links.forEach((linkObj: LinkWithContext) => {
        newNodes.push({ id: linkObj.title, title: linkObj.title });
        newAutoDiscovered.add(linkObj.title);
        newLinks.push({
          source: resolvedTitle,
          target: linkObj.title,
          id: `${resolvedTitle}-${linkObj.title}`,
          type: 'manual',
          context: linkObj.context
        });
      });

      backlinks.forEach((blTitle: string) => {
        if (!blTitle || blTitle === resolvedTitle) return;
        newNodes.push({ id: blTitle, title: blTitle });
        newAutoDiscovered.add(blTitle);
        newLinks.push({
          source: blTitle,
          target: resolvedTitle,
          id: `${blTitle}-${resolvedTitle}`,
          type: 'backlink',
        });
      });

      setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));

      // Auto-connect existing
      const graphNodeIds = new Set(graphManagerRef.current?.getNodeIds() || []);
      WikiService.getCachedNodes().forEach(existingNodeId => {
        if (!graphNodeIds.has(existingNodeId)) return;
        const cachedLinks = WikiService.getLinksFromCache(existingNodeId);
        const match = cachedLinks?.find(l => l.title === resolvedTitle);
        if (match) {
          newLinks.push({
            source: existingNodeId,
            target: resolvedTitle,
            id: `${existingNodeId}-${resolvedTitle}`,
            type: 'auto',
            context: match.context
          });
        }
      });

      if (epoch !== mutationEpochRef.current) return resolvedTitle;
      updateQueueRef.current.queueUpdate(newNodes, newLinks);
      if (!silent) setSearchTerm('');

      return resolvedTitle;
    } catch (err: any) {
      console.error('Add topic error:', err);
      setError(err.message || 'Failed to fetch Wikipedia data');
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const addTopicFromSearchUI = (title: string) => {
    setShowFeaturedPaths(false);
    setShowSuggestions(false);
    return addTopic(title);
  };

  const deleteNodeImperative = (nodeId: string) => {
    pushHistory();
    if (graphManagerRef.current) {
      graphManagerRef.current.deleteNode(nodeId);
    }

    setUserTypedNodes(prev => { const s = new Set(prev); s.delete(nodeId); return s; });
    setAutoDiscoveredNodes(prev => { const s = new Set(prev); s.delete(nodeId); return s; });
    setExpandedNodes(prev => { const s = new Set(prev); s.delete(nodeId); return s; });
    setPathNodes(prev => { const s = new Set(prev); s.delete(nodeId); return s; });

    if (clickedNode?.id === nodeId) {
      setClickedNode(null);
    }
  };

  const pruneGraph = () => {
    const ids = bulkSelectedNodes.map(n => n.id);
    if (ids.length === 0) {
      setError('No bulk selection to delete (Alt+Drag).');
      setTimeout(() => setError(''), 2500);
      return;
    }

    if (!graphManagerRef.current) return;

    pushHistory();

    ids.forEach(id => graphManagerRef.current!.deleteNode(id));

    const deletedIds = new Set(ids);
    setBulkSelectedNodes([]);
    setPathSelectedNodes(prev => prev.filter(n => !deletedIds.has(n.id)));
    setPathNodes(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.delete(id));
      return s;
    });
    setUserTypedNodes(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.delete(id));
      return s;
    });
    setAutoDiscoveredNodes(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.delete(id));
      return s;
    });
    setExpandedNodes(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.delete(id));
      return s;
    });

    if (clickedNode && deletedIds.has(clickedNode.id)) setClickedNode(null);

    // Close any open contexts; their backing links may have been removed.
    setActiveLinkContexts(new Set());
    setSearchDockLinkId(null);
    setSearchDockPosition(null);

    setError(`Deleted ${ids.length} selected nodes.`);
    setTimeout(() => setError(''), 2500);
  };

  const pruneLeafNodes = () => {
    if (!graphManagerRef.current) return;
    pushHistory();
    const deletedCount = graphManagerRef.current.pruneNodes();
    if (deletedCount > 0) {
      setError(`Pruned ${deletedCount} leaf nodes (degree < 2).`);
      setTimeout(() => setError(''), 2500);
    } else {
      setError('No leaf nodes found to prune.');
      setTimeout(() => setError(''), 2500);
    }
  };

  const cancelSearch = () => {
    searchAbortRef.current = true;
    searchPauseRef.current = false;
    setSearchDockLinkId(null);
    setSearchDockPosition(null);
    setFoundPaths([]);
    setError('Search cancelled');
    setSearchLog(prev => [...prev, `[USER] Abort command received.`]);
    setTimeout(() => {
      setSearchProgress(prev => ({ ...prev, isSearching: false, isPaused: false }));
      setPathSelectedNodes([]);
    }, 1000);
  }

  const pauseSearch = () => {
    searchPauseRef.current = true;
    setSearchProgress(prev => ({ ...prev, isPaused: true }));
    setSearchLog(prev => [...prev, `[USER] Pause command received.`].slice(-8));
  };

  const resumeSearch = () => {
    searchPauseRef.current = false;
    setSearchProgress(prev => ({ ...prev, isPaused: false }));
    setSearchLog(prev => [...prev, `[USER] Resume command received.`].slice(-8));
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
    // Bot protection: verify reCAPTCHA before allowing pathfinding
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

  const runQueuedSearch = async (job: { id: string; from: string; to: string; source: 'suggested' | 'shift' }) => {
    isRunningSearchRef.current = true;
    setActiveSearch(job);
    setSearchTerminalMinimized(false);

    const resetGraphForSuggested = async () => {
      pushHistory();
      mutationEpochRef.current++;
      updateQueueRef.current?.clear();

      if (graphManagerRef.current) graphManagerRef.current.clear();
      setUserTypedNodes(new Set());
      setAutoDiscoveredNodes(new Set());
      setExpandedNodes(new Set());
      setPathNodes(new Set());
      setBulkSelectedNodes([]);
      setPathSelectedNodes([]);
      setClickedNode(null);
      setClickedSummary('');
      setActiveLinkContexts(new Set());
      setSearchDockLinkId(null);
      setSearchDockPosition(null);
      setFoundPaths([]);
      setError('');
    };

    try {
      if (job.source === 'suggested') {
        await resetGraphForSuggested();
        setShowFeaturedPaths(false);
        setShowSuggestions(false);
        setSearchTerm(`${job.from} → ${job.to}`);
        setSearchLog([`[QUEUE] Seeding "${job.from}" and "${job.to}"...`]);
        setSearchProgress(prev => ({ ...prev, isSearching: true, isPaused: false }));
      } else {
        setSearchLog([`[QUEUE] Searching path: ${job.from} → ${job.to}`]);
      }

      const [startTitle, endTitle] = await Promise.all([addTopic(job.from, true), addTopic(job.to, true)]);
      setSearchLog(prev => [...prev, `[QUEUE] Launching pathfinder...`].slice(-8));
      await findPath(startTitle || job.from, endTitle || job.to);
    } catch (err: any) {
      setError(err?.message || 'Error during queued search');
    } finally {
      isRunningSearchRef.current = false;
      setActiveSearch(null);
      if (searchQueueRef.current.length > 0) {
        const next = searchQueueRef.current[0];
        searchQueueRef.current = searchQueueRef.current.slice(1);
        setSearchQueue(searchQueueRef.current);
        runQueuedSearch(next);
      }
    }
  };

  const runSuggestedPath = async (from: string, to: string) => {
    await enqueueSearch(from, to, 'suggested');
  };

  const expandNode = async (title: string) => {
    if (expandedNodes.has(title)) {
      setExpandedNodes(prev => { const s = new Set(prev); s.delete(title); return s; });
      return;
    }
    setLoading(true);

    const epoch = mutationEpochRef.current;

    try {
      const [linksWithContext, backlinks, categories] = await Promise.all([
        WikiService.fetchLinks(title),
        includeBacklinks ? WikiService.fetchBacklinks(title, 30) : Promise.resolve([]),
        WikiService.fetchCategories(title).catch(() => []),
      ]);

      if (epoch !== mutationEpochRef.current) return;
      pushHistory();

      const gm = graphManagerRef.current;
      const existingGraphNodeIds = new Set(gm?.getNodeIds() || []);

      if (categories.length > 0) setNodeCategories(prev => ({ ...prev, [title]: categories }));
      if (includeBacklinks) setNodeBacklinkCounts(prev => ({ ...prev, [title]: backlinks.length }));

      const boldSet = new Set(WikiService.getBoldLinkTitlesFromCache(title) || []);
      const backlinkSet = new Set(backlinks);
      const outSet = new Set(linksWithContext.map(l => l.title));

      const sourceCategories = categories.length > 0 ? categories : (nodeCategories[title] || []);
      const sharedCategoryCount = (candidateTitle: string) => {
        const candidateCategories = nodeCategories[candidateTitle];
        if (!candidateCategories || candidateCategories.length === 0) return 0;
        if (!sourceCategories || sourceCategories.length === 0) return 0;
        const set = new Set(candidateCategories);
        let count = 0;
        for (const c of sourceCategories) {
          if (set.has(c)) count++;
        }
        return count;
      };

      type Candidate = { title: string; direction: 'out' | 'in'; context?: string; isBold: boolean; isBidirectional: boolean; sharedCats: number };
      const candidates: Candidate[] = [];

      linksWithContext.forEach(linkObj => {
        const candidateTitle = linkObj.title;
        if (!candidateTitle || candidateTitle === title) return;
        candidates.push({
          title: candidateTitle,
          direction: 'out',
          context: linkObj.context,
          isBold: boldSet.has(candidateTitle),
          isBidirectional: backlinkSet.has(candidateTitle),
          sharedCats: sharedCategoryCount(candidateTitle),
        });
      });

      backlinks.forEach((blTitle: string) => {
        if (!blTitle || blTitle === title) return;
        if (outSet.has(blTitle)) return; // bidirectional already represented via outgoing link
        candidates.push({
          title: blTitle,
          direction: 'in',
          context: undefined,
          isBold: false,
          isBidirectional: false,
          sharedCats: sharedCategoryCount(blTitle),
        });
      });

      const scoreOf = (c: Candidate) => {
        const inGraph = existingGraphNodeIds.has(c.title);
        const degree = inGraph ? (gm?.getNodeDegree(c.title) || 0) : 0;
        return (
          degree * 10 +
          (inGraph ? 20 : 10) +
          (c.direction === 'in' ? 15 : 0) +
          (c.isBidirectional ? 35 : 0) +
          (c.isBold ? 12 : 0) +
          (c.sharedCats * 15)
        );
      };

      const sortedCandidates = candidates
        .sort((a, b) => scoreOf(b) - scoreOf(a))
        .slice(0, 15);
      const nodesToAdd: GraphNode[] = [];
      const linksToAdd: Link[] = [];
      const newAutoDiscovered = new Set<string>();

      sortedCandidates.forEach(c => {
        const candidateTitle = c.title;
        nodesToAdd.push({ id: candidateTitle, title: candidateTitle });
        newAutoDiscovered.add(candidateTitle);

        if (c.direction === 'out') {
          linksToAdd.push({
            source: title,
            target: candidateTitle,
            id: `${title}-${candidateTitle}`,
            type: c.isBidirectional ? 'expand_backlink' : 'expand',
            context: c.context
          });
        } else {
          linksToAdd.push({
            source: candidateTitle,
            target: title,
            id: `${candidateTitle}-${title}`,
            type: 'expand_backlink',
          });
        }

        existingGraphNodeIds.forEach(existing => {
          if (existing === title) return;
          const existingLinks = WikiService.getLinksFromCache(existing);
          const match = existingLinks?.find(l => l.title === candidateTitle);
          if (match) linksToAdd.push({
            source: existing,
            target: candidateTitle,
            id: `${existing}-${candidateTitle}`,
            type: 'auto',
            context: match.context
          });
        });
      });

      if (nodesToAdd.length === 0) setError('No relevant connections found.');
      else {
        if (epoch !== mutationEpochRef.current) return;
        if (updateQueueRef.current) updateQueueRef.current.queueUpdate(nodesToAdd, linksToAdd);
        if (newAutoDiscovered.size > 0) setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));
        setExpandedNodes(prev => new Set([...prev, title]));
      }
    } catch (err: any) {
      setError(`Failed to expand ${title}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = async (event: any, d: GraphNode) => {
    if (event.defaultPrevented) return;
    event.stopPropagation();
    // setClickedLink(null); // No longer clearing single link


    if (event.ctrlKey || event.metaKey) {
      window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}`, '_blank');
      return;
    }

    if (event.shiftKey) {
      let shouldEnqueue = false;
      let n1Id = '';
      let n2Id = '';

      setPathSelectedNodes(prev => {
        const newSelection = [...prev];
        const index = newSelection.findIndex(n => n.id === d.id);
        if (index >= 0) {
          newSelection.splice(index, 1);
          setPathNodes(new Set());
          setError('');
          // setClickedLink(null);
        } else {
          newSelection.push(d);
          if (newSelection.length > 2) newSelection.shift();
        }

        if (newSelection.length === 2) {
          const [n1, n2] = newSelection;
          const directLink = graphManagerRef.current?.getLinkBetween(n1.id, n2.id);
          if (directLink) {
            // Optional: Auto-open context here?
          }
          shouldEnqueue = true;
          n1Id = n1.id;
          n2Id = n2.id;
        } else {
          setPathNodes(new Set()); setError('');
        }
        return newSelection;
      });

      if (shouldEnqueue) {
        await enqueueSearch(n1Id, n2Id, 'shift');
      }
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
  };

  const handleLinkClick = (event: any, d: Link) => {
    event.stopPropagation();

    // Toggle link context
    if (!d.id) return; // Should have ID now
    const isOn = activeLinkContexts.has(d.id);

    if (!isOn && !d.context && graphManagerRef.current) {
      const source = typeof d.source === 'object' ? d.source.id : d.source;
      const target = typeof d.target === 'object' ? d.target.id : d.target;
      const linkId = d.id;
      const linkType = d.type;

      // Lazy-fetch missing snippet context (especially useful for incoming links + path hops).
      void WikiService.fetchLinkContext(source, target).then((context) => {
        const nextContext = context || (() => {
          if (typeof linkType === 'string' && linkType.includes('backlink')) {
            return `Snippet unavailable. Connection confirmed because “${source}” contains a link to “${target}”.`;
          }
          return `Snippet unavailable. Connection confirmed because “${source}” contains a link to “${target}”.`;
        })();
        graphManagerRef.current?.addLinks([{
          source,
          target,
          id: linkId,
          type: linkType,
          context: nextContext,
        }]);
      });
    }

    setActiveLinkContexts(prev => {
      const next = new Set(prev);
      if (isOn) next.delete(d.id!);
      else next.add(d.id!);
      return next;
    });
  };

  const handleNodeDoubleClick = (event: any, d: GraphNode) => {
    event.stopPropagation();
    expandNode(d.id);
  };

  useEffect(() => {
    graphManagerRef.current?.setPathHighlight(pathNodes.size > 0 ? pathNodes : null);
  }, [pathNodes]);

  return (
    <div className="w-screen h-screen bg-gray-900 text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <LensingGridBackground graphManagerRef={graphManagerRef} />
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* Floating Search */}
      <SearchOverlay
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
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
        onAddTopic={addTopicFromSearchUI}
        onRunSuggestedPath={runSuggestedPath}
      />

      {/* Floating Controls */}
      <GraphControls
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        nodeSpacing={nodeSpacing}
        setNodeSpacing={setNodeSpacing}
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
        onPruneLeaves={pruneLeafNodes}
        onDeleteSelection={pruneGraph}
      />

      {/* Search Terminal Overlays */}
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
        onOpenLogs={() => setLogPanelOpen(true)}
      />

      {/* Floating Node Details - Side Panel */}
      <NodeDetailsPanel
        clickedNode={clickedNode}
        clickedSummary={clickedSummary}
        clickedDescription={clickedNode ? nodeDescriptions[clickedNode.title] : undefined}
        clickedCategories={clickedNode ? nodeCategories[clickedNode.title] : undefined}
        clickedBacklinkCount={clickedNode ? nodeBacklinkCounts[clickedNode.title] : undefined}
        nodeThumbnails={nodeThumbnails}
        onClose={() => setClickedNode(null)}
        onExpand={expandNode}
        onPruneLeaves={pruneLeafNodes}
        onDelete={deleteNodeImperative}
      />

      {/* Attached Link Contexts */}
      <LinkContextsLayer
        activeLinkIds={Array.from(activeLinkContexts)}
        positions={linkContextPositions}
        getLinkById={(linkId) => graphManagerRef.current?.getLinkById(linkId)}
        scale={nodeSizeScale}
        onCloseLinkId={(linkId) =>
          setActiveLinkContexts(prev => {
            const n = new Set(prev);
            n.delete(linkId);
            return n;
          })
        }
      />

      {/* Connection Analytics */}
      <LogPanel isOpen={logPanelOpen} onClose={() => setLogPanelOpen(false)} />
    </div>
  );
};

export default WikiWebExplorer;
