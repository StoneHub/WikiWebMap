import { useState, useEffect, useRef } from 'react';
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

  // Settings Visibility
  const [showSettings, setShowSettings] = useState(false);
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
  const animationFrameRef = useRef<number>();
  const activeLinkContextsRef = useRef<Set<string>>(new Set());
  const linkContextPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const searchDockLinkIdRef = useRef<string | null>(null);
  const mutationEpochRef = useRef(0);

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
  const [searchDepth, setSearchDepth] = useState(2);
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

  // Initialize GraphManager
  useEffect(() => {
    if (!svgRef.current || graphManagerRef.current) return;

    graphManagerRef.current = new GraphManager(svgRef.current, {
      onNodeClick: (node, event) => handleNodeClick(event as any, node),
      onNodeDoubleClick: (node, event) => handleNodeDoubleClick(event as any, node),
      onLinkClick: (link, event) => handleLinkClick(event as any, link),
      onSelectionChange: (nodes) => setBulkSelectedNodes(nodes),
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
      const links = await WikiService.fetchLinks(resolvedTitle);
      const summaryData = await WikiService.fetchSummary(resolvedTitle);

      if (epoch !== mutationEpochRef.current) return resolvedTitle;
      pushHistory();

      if (summaryData.thumbnail) {
        setNodeThumbnails(prev => ({ ...prev, [resolvedTitle]: summaryData.thumbnail! }));
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

      setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));

      // Color grouping: root + its direct children
      graphManagerRef.current?.setNodesMetadata([
        { nodeId: resolvedTitle, metadata: { colorSeed: resolvedTitle, colorRole: 'root' } },
        ...Array.from(newAutoDiscovered).map(id => ({
          nodeId: id,
          metadata: { colorSeed: resolvedTitle, colorRole: 'child' as const },
        })),
      ]);

      // Auto-connect existing
      const cachedNodes = WikiService.getCachedNodes();
      cachedNodes.forEach(existingNodeId => {
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
      maxDepth: searchDepth,
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

  const runSuggestedPath = (from: string, to: string) => {
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

    setShowFeaturedPaths(false);
    setShowSuggestions(false);
    setSearchTerm(`${from} → ${to}`);

    suppressHistoryRef.current = true;
    setSearchLog([`[SUGGESTED] Seeding "${from}" and "${to}"...`]);
    setSearchProgress(prev => ({ ...prev, isSearching: true, isPaused: false }));

    void (async () => {
      try {
        const [startTitle, endTitle] = await Promise.all([addTopic(from, true), addTopic(to, true)]);
        setSearchLog(prev => [...prev, `[SUGGESTED] Launching pathfinder...`].slice(-8));
        await findPath(startTitle || from, endTitle || to);
      } finally {
        suppressHistoryRef.current = false;
      }
    })();
  };

  const expandNode = async (title: string) => {
    if (expandedNodes.has(title)) {
      setExpandedNodes(prev => { const s = new Set(prev); s.delete(title); return s; });
      return;
    }
    setLoading(true);

    const epoch = mutationEpochRef.current;

    try {
      const linksWithContext = await WikiService.fetchLinks(title);

      if (epoch !== mutationEpochRef.current) return;
      pushHistory();

      const existingNodes = WikiService.getCachedNodes();
      const scores: Record<string, number> = {};

      linksWithContext.forEach(linkObj => {
        const candidate = linkObj.title;
        scores[candidate] = 0;
        if (graphManagerRef.current?.getStats().nodeCount && WikiService.getLinksFromCache(candidate)) scores[candidate] += 50;
        existingNodes.forEach(existing => {
          if (existing === title) return;
          const existingLinks = WikiService.getLinksFromCache(existing);
          if (existingLinks && existingLinks.some(l => l.title === candidate)) scores[candidate] += 10;
        });
      });

      const sortedCandidates = linksWithContext.sort((a, b) => (scores[b.title] || 0) - (scores[a.title] || 0)).slice(0, 15);
      const nodesToAdd: GraphNode[] = [];
      const linksToAdd: Link[] = [];
      const newAutoDiscovered = new Set<string>();

      sortedCandidates.forEach(linkObj => {
        const link = linkObj.title;
        nodesToAdd.push({ id: link, title: link });
        newAutoDiscovered.add(link);
        linksToAdd.push({
          source: title,
          target: link,
          id: `${title}-${link}`,
          type: 'expand',
          context: linkObj.context
        });

        existingNodes.forEach(existing => {
          const existingLinks = WikiService.getLinksFromCache(existing);
          const match = existingLinks?.find(l => l.title === link);
          if (match) linksToAdd.push({
            source: existing,
            target: link,
            id: `${existing}-${link}`,
            type: 'auto',
            context: match.context
          });
        });
      });

      if (nodesToAdd.length === 0) setError('No relevant connections found.');
      else {
        // Color grouping: expanded node + its direct children
        graphManagerRef.current?.setNodesMetadata([
          { nodeId: title, metadata: { colorSeed: title, colorRole: 'root' } },
          ...Array.from(newAutoDiscovered).map(id => ({
            nodeId: id,
            metadata: { colorSeed: title, colorRole: 'child' as const },
          })),
        ]);

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
          findPath(n1.id, n2.id);
        } else {
          setPathNodes(new Set()); setError('');
        }
        return newSelection;
      });
      return;
    }

    if (graphManagerRef.current) graphManagerRef.current.highlightNode(d.id);

    setClickedNode(d);
    const result = await WikiService.fetchSummary(d.title);
    setClickedSummary(result.summary);
    // setClickedThumbnail(result.thumbnail || '');
    if (result.thumbnail) setNodeThumbnails(prev => ({ ...prev, [d.title]: result.thumbnail! }));
  };

  const handleLinkClick = (event: any, d: Link) => {
    event.stopPropagation();

    // Toggle link context
    if (!d.id) return; // Should have ID now
    const isOn = activeLinkContexts.has(d.id);

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
        onSearchChange={async (e) => {
          const term = e.target.value;
          setSearchTerm(term);
          if (term.length >= 2) {
            const results = await WikiService.search(term);
            setSuggestions(results);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
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
        searchDepth={searchDepth}
        setSearchDepth={setSearchDepth}
        nodeSizeScale={nodeSizeScale}
        setNodeSizeScale={setNodeSizeScale}
        apiContactEmail={apiContactEmail}
        setApiContactEmail={setApiContactEmail}
        onPrune={pruneGraph}
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
      />

      {/* Floating Node Details - Side Panel */}
      <NodeDetailsPanel
        clickedNode={clickedNode}
        clickedSummary={clickedSummary}
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

    </div>
  );
};

export default WikiWebExplorer;
