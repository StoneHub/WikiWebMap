import { useState, useEffect, useRef } from 'react';
import { GraphManager, Node as GraphNode, Link } from './GraphManager';
import { UpdateQueue } from './UpdateQueue';
import { WikiService, LinkWithContext } from './WikiService';
import './index.css';

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
  const [clickedLink, setClickedLink] = useState<Link | null>(null);
  const [clickedSummary, setClickedSummary] = useState('');
  const [clickedThumbnail, setClickedThumbnail] = useState('');
  const [selectedNodes, setSelectedNodes] = useState<GraphNode[]>([]);
  const [pathNodes, setPathNodes] = useState(new Set<string>());
  const [userTypedNodes, setUserTypedNodes] = useState(new Set<string>());
  const [autoDiscoveredNodes, setAutoDiscoveredNodes] = useState(new Set<string>());
  const [recentlyAddedNodes] = useState(new Set<string>());
  const [expandedNodes, setExpandedNodes] = useState(new Set<string>());
  const [nodeThumbnails, setNodeThumbnails] = useState<Record<string, string>>({});

  // Search Progress State
  const [searchProgress, setSearchProgress] = useState({
    isSearching: false,
    currentDepth: 0,
    maxDepth: 6,
    currentPage: '',
    exploredCount: 0,
    queueSize: 0,
    exploredNodes: new Set<string>(),
  });
  const [searchLog, setSearchLog] = useState<string[]>([]); // Granular log

  // Settings Visibility
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const graphManagerRef = useRef<GraphManager | null>(null);
  const updateQueueRef = useRef<UpdateQueue | null>(null);
  const searchAbortRef = useRef(false);

  // Visual settings
  const [nodeSpacing, setNodeSpacing] = useState(150);
  const [searchDepth, setSearchDepth] = useState(2);

  // Initialize GraphManager
  useEffect(() => {
    if (!svgRef.current || graphManagerRef.current) return;

    graphManagerRef.current = new GraphManager(svgRef.current, {
      onNodeClick: (node, event) => handleNodeClick(event as any, node),
      onNodeDoubleClick: (node, event) => handleNodeDoubleClick(event as any, node),
      onLinkClick: (link, event) => handleLinkClick(event as any, link),
      onNodeDragEnd: (node, isOverTrash) => {
        if (isOverTrash) {
          deleteNodeImperative(node.id);
        }
      },
      onStatsUpdate: (stats) => {
        setNodeCount(stats.nodeCount);
        setLinkCount(stats.linkCount);
      },
    });

    updateQueueRef.current = new UpdateQueue(graphManagerRef.current, 500);

    return () => {
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

  // Sync settings
  useEffect(() => {
    if (graphManagerRef.current) {
      graphManagerRef.current.setNodeSpacing(nodeSpacing);
    }
  }, [nodeSpacing]);

  // Sync node metadata
  useEffect(() => {
    if (!graphManagerRef.current) return;

    const updates = Array.from(
      new Set([
        ...userTypedNodes,
        ...autoDiscoveredNodes,
        ...expandedNodes,
        ...pathNodes,
        ...recentlyAddedNodes,
        ...selectedNodes.map(n => n.id),
      ])
    ).map(nodeId => ({
      nodeId,
      metadata: {
        isUserTyped: userTypedNodes.has(nodeId),
        isAutoDiscovered: autoDiscoveredNodes.has(nodeId),
        isExpanded: expandedNodes.has(nodeId),
        isInPath: pathNodes.has(nodeId),
        isRecentlyAdded: recentlyAddedNodes.has(nodeId),
        isSelected: selectedNodes.some(n => n.id === nodeId),
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
    selectedNodes,
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

    try {
      const resolvedTitle = await WikiService.resolveTitle(title);
      const links = await WikiService.fetchLinks(resolvedTitle);
      const summaryData = await WikiService.fetchSummary(resolvedTitle);
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
          type: 'manual',
          context: linkObj.context
        });
      });

      setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));

      // Auto-connect existing
      const cachedNodes = WikiService.getCachedNodes();
      cachedNodes.forEach(existingNodeId => {
        const cachedLinks = WikiService.getLinksFromCache(existingNodeId);
        const match = cachedLinks?.find(l => l.title === resolvedTitle);
        if (match) {
          newLinks.push({
            source: existingNodeId,
            target: resolvedTitle,
            type: 'auto',
            context: match.context
          });
        }
      });

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

  const deleteNodeImperative = (nodeId: string) => {
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
    if (graphManagerRef.current) {
      const deletedCount = graphManagerRef.current.pruneNodes();
      if (deletedCount > 0) {
        setError(`Pruned ${deletedCount} isolated nodes`);
        setTimeout(() => setError(''), 3000);
      } else {
        setError('No isolated nodes found to prune');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const cancelSearch = () => {
    searchAbortRef.current = true;
    setError('Search cancelled');
    setSearchLog(prev => [...prev, `[USER] Abort command received.`]);
    setTimeout(() => {
      setSearchProgress(prev => ({ ...prev, isSearching: false }));
      setSelectedNodes([]);
    }, 1000);
  }

  const findPath = async (startInput: string, endInput: string) => {
    // 1. Resolve Titles (Robustness Fix)
    setLoading(true);
    setSearchLog(['Initializing PathFinder protocol...']);
    let startTitle = startInput;
    let endTitle = endInput;

    try {
      setSearchLog(prev => [...prev, `Resolving targets: "${startInput}" / "${endInput}"`]);
      const [rStart, rEnd] = await Promise.all([
        WikiService.resolveTitle(startInput),
        WikiService.resolveTitle(endInput)
      ]);
      startTitle = rStart;
      endTitle = rEnd;
      setSearchLog(prev => [...prev, `Target Lock: "${startTitle}" → "${endTitle}"`]);
    } catch (e) {
      setSearchLog(prev => [...prev, `Resolution warning. Proceeding with raw inputs.`]);
    }

    setSearchProgress({
      isSearching: true,
      currentDepth: 0,
      maxDepth: 6,
      exploredCount: 0,
      currentPage: startTitle,
      queueSize: 1,
      exploredNodes: new Set([startTitle])
    });
    setPathNodes(new Set());
    setError('');
    searchAbortRef.current = false;

    const queue: { title: string; depth: number }[] = [{ title: startTitle, depth: 0 }];
    const visited = new Set<string>([startTitle]);
    const parentMap = new Map<string, string>();
    let nodesExplored = 0;

    try {
      while (queue.length > 0) {
        if (searchAbortRef.current) break;
        const { title, depth } = queue.shift()!;

        nodesExplored++;
        // Granular Log Update
        if (nodesExplored % 3 === 0) {
          setSearchLog(prev => {
            const newLogs = [...prev, `Scanning: ${title.substring(0, 20)}... (D${depth})`];
            return newLogs.slice(-8); // Keep last 8 lines
          });
        }

        if (nodesExplored % 5 === 0) {
          setSearchProgress(prev => ({ ...prev, exploredCount: nodesExplored, currentDepth: depth, currentPage: title, queueSize: queue.length }));
          await new Promise(r => setTimeout(r, 0));
        }

        if (depth >= 6) continue;
        if (nodesExplored > 500) throw new Error(`Exceeded exploration limit (500 nodes).`);

        const links = await WikiService.fetchLinks(title);

        for (const linkObj of links) {
          const link = linkObj.title;
          if (visited.has(link)) continue;

          if (link === endTitle) {
            setSearchLog(prev => [...prev, `>> TARGET ACQUIRED: ${link} <<`]);
            parentMap.set(link, title);
            const path: string[] = [endTitle];
            let curr = endTitle;
            while (curr !== startTitle) {
              const p = parentMap.get(curr)!;
              path.unshift(p);
              curr = p;
            }
            console.log('[PathFinder] Path:', path.join(' -> '));

            const newNodes = path.map(p => ({ id: p, title: p }));
            const newLinks: Link[] = [];
            for (let i = 0; i < path.length - 1; i++) {
              const source = path[i];
              const target = path[i + 1];
              const sourceLinks = WikiService.getLinksFromCache(source);
              const context = sourceLinks?.find(l => l.title === target)?.context;
              newLinks.push({ source, target, type: 'path', context });
            }

            if (graphManagerRef.current) {
              graphManagerRef.current.addNodes(newNodes);
              graphManagerRef.current.addLinks(newLinks);
              setPathNodes(new Set(path));

              const updates = path.map(p => ({ nodeId: p, metadata: { isInPath: true } }));
              graphManagerRef.current.setNodesMetadata(updates);
              graphManagerRef.current.highlightNode(null);
            }

            setSelectedNodes([]);
            setSearchProgress(prev => ({ ...prev, isSearching: false }));
            setLoading(false);
            return;
          }

          visited.add(link);
          parentMap.set(link, title);
          queue.push({ title: link, depth: depth + 1 });
        }
      }
      if (!searchAbortRef.current) {
        setError('No path found within search limits.');
        setSearchLog(prev => [...prev, `[FAILURE] Target not found in search horizon.`]);
      }
    } catch (err: any) {
      setError(err.message || 'Error during pathfinding');
      setSearchLog(prev => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setLoading(false);
      setSearchProgress(prev => ({ ...prev, isSearching: false }));
    }
  };

  // --- Auto-Test Feature ---
  const runAutoTest = async () => {
    // 1. Close settings so user can see the main UI
    setShowSettings(false);

    console.log('[AutoTest] 🚀 Starting Auto-Test Protocol (No Confirm)...');
    if (graphManagerRef.current) graphManagerRef.current.clear();

    // 3. Reset State & Show Terminal
    setSearchTerm('Auto-Test Running...'); // Visual feedback in input
    setSearchLog(['[TEST] 🧪 Starting Protocol verify_fix_1...']);
    setSearchProgress(prev => ({ ...prev, isSearching: true, exploredCount: 0 }));

    try {
      // 4. Add Start Node
      setSearchLog(prev => [...prev, '[TEST] Seeding start node: "Facebook"...']);
      console.log('[AutoTest] Adding start node...');
      setSearchTerm('Adding: Facebook');
      const startTitle = await addTopic('Facebook', true);

      // 5. Add End Node (simulated typo)
      setSearchLog(prev => [...prev, '[TEST] Seeding target node: "The first ammendment" (Typo)...']);
      console.log('[AutoTest] Adding end node...');
      setSearchTerm('Adding: The first ammendment');
      const endTitle = await addTopic('The first ammendment', true);

      if (!startTitle || !endTitle) throw new Error("Failed to seed nodes (API Error?)");

      setSearchLog(prev => [...prev, `[TEST] Nodes seeded. Resolved: "${startTitle}" & "${endTitle}"`]);
      setSearchTerm('Waiting for Physics...');

      // 6. Wait for Graph to be ready
      let attempts = 0;
      const checkGraph = setInterval(() => {
        attempts++;
        const hasNodes = graphManagerRef.current?.getStats().nodeCount || 0;
        console.log(`[AutoTest] Checking graph nodes: ${hasNodes} (Attempt ${attempts})`);

        if (hasNodes >= 2) {
          clearInterval(checkGraph);
          setSearchLog(prev => [...prev, '[TEST] Graph ready. Launching Pathfinder...']);
          console.log('[AutoTest] Graph ready. Starting findPath...');
          setSearchTerm(`Searching: ${startTitle} -> ${endTitle}`);
          findPath(startTitle, endTitle);
        } else if (attempts > 50) { // 10 seconds timeout
          clearInterval(checkGraph);
          setSearchLog(prev => [...prev, '[TEST] ❌ Timed out waiting for nodes.']);
          setError('Auto-Test Timeout: Nodes did not appear.');
          // Alert removed as requested
          setSearchProgress(prev => ({ ...prev, isSearching: false }));
        }
      }, 200);

    } catch (e: any) {
      console.error('[AutoTest] Error:', e);
      setSearchLog(prev => [...prev, `[TEST] ❌ Error: ${e.message}`]);
      setError(`Auto-Test Error: ${e.message}`);
      setSearchProgress(prev => ({ ...prev, isSearching: false }));
    }
  };

  const expandNode = async (title: string) => {
    if (expandedNodes.has(title)) {
      setExpandedNodes(prev => { const s = new Set(prev); s.delete(title); return s; });
      return;
    }
    setLoading(true);
    try {
      const linksWithContext = await WikiService.fetchLinks(title);
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
        linksToAdd.push({ source: title, target: link, type: 'expand', context: linkObj.context });

        existingNodes.forEach(existing => {
          const existingLinks = WikiService.getLinksFromCache(existing);
          const match = existingLinks?.find(l => l.title === link);
          if (match) linksToAdd.push({ source: existing, target: link, type: 'auto', context: match.context });
        });
      });

      if (nodesToAdd.length === 0) setError('No relevant connections found.');
      else {
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
    setClickedLink(null);

    if (event.ctrlKey || event.metaKey) {
      window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}`, '_blank');
      return;
    }

    if (event.shiftKey) {
      setSelectedNodes(prev => {
        const newSelection = [...prev];
        const index = newSelection.findIndex(n => n.id === d.id);
        if (index >= 0) {
          newSelection.splice(index, 1);
          setPathNodes(new Set());
          setError('');
          setClickedLink(null);
        } else {
          newSelection.push(d);
          if (newSelection.length > 2) newSelection.shift();
        }

        if (newSelection.length === 2) {
          const [n1, n2] = newSelection;
          const directLink = graphManagerRef.current?.getLinkBetween(n1.id, n2.id);
          if (directLink) setClickedLink(directLink);
          else setClickedLink(null);

          findPath(n1.id, n2.id);
        } else {
          setPathNodes(new Set()); setError(''); setClickedLink(null);
        }
        return newSelection;
      });
      return;
    }

    if (graphManagerRef.current) graphManagerRef.current.highlightNode(d.id);

    setClickedNode(d);
    const result = await WikiService.fetchSummary(d.title);
    setClickedSummary(result.summary);
    setClickedThumbnail(result.thumbnail || '');
    if (result.thumbnail) setNodeThumbnails(prev => ({ ...prev, [d.title]: result.thumbnail! }));
  };

  const handleLinkClick = (event: any, d: Link) => {
    event.stopPropagation();
    setClickedNode(null);
    setClickedLink(d);
  };

  const handleNodeDoubleClick = (event: any, d: GraphNode) => {
    event.stopPropagation();
    expandNode(d.id);
  };

  return (
    <div className="w-screen h-screen bg-gray-900 text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* Floating Search */}
      <div className="absolute top-6 left-6 z-20 w-96 max-w-full">
        <div className="bg-gray-800/90 backdrop-blur-md border border-gray-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
          <h1 className="text-xl font-bold text-blue-400 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">WikiWeb Explorer</h1>

          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={async (e) => {
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
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
              onKeyPress={(e) => e.key === 'Enter' && addTopic(searchTerm)}
              placeholder="Evaluate topic..."
              className="w-full pl-4 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder-gray-500"
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
                    addTopic(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => addTopic(searchTerm)}
            disabled={loading || !searchTerm}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold shadow-lg transition-all transform active:scale-95"
          >
            {loading ? 'Thinking...' : 'Start Exploration'}
          </button>

          {error && (
            <div className={`text-xs px-2 py-1 rounded bg-red-900/20 border border-red-500/30 ${error.startsWith('Path found') ? 'text-green-400 border-green-500/30' : 'text-red-400'}`}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-3">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-12 h-12 bg-gray-800/80 backdrop-blur-md border border-gray-600/50 rounded-full shadow-xl flex items-center justify-center hover:bg-gray-700 text-gray-300 transition-all hover:scale-105"
          title="Settings"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
        </button>

        {/* Settings Bubble */}
        {showSettings && (
          <div className="bg-gray-800/90 backdrop-blur-md border border-gray-700/50 rounded-2xl p-4 shadow-2xl w-64 mb-1 animate-fade-in-up">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Graph Physics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Spacing</span>
                  <span>{nodeSpacing}px</span>
                </div>
                <input type="range" min="80" max="300" value={nodeSpacing} onChange={(e) => setNodeSpacing(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Recursion Depth</span>
                  <span>{searchDepth}</span>
                </div>
                <input type="range" min="1" max="3" value={searchDepth} onChange={(e) => setSearchDepth(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              {/* Auto Test Button */}
              <button
                onClick={runAutoTest}
                className="w-full py-2 bg-purple-900/30 border border-purple-500/50 text-purple-300 text-xs rounded hover:bg-purple-900/50 transition"
              >
                🛠️ Run Auto-Test (Facebook)
              </button>
            </div>
          </div>
        )}

        <button
          onClick={pruneGraph}
          className="h-12 px-6 bg-gray-800/80 hover:bg-red-900/80 backdrop-blur-md border border-gray-600/50 hover:border-red-500/50 rounded-full shadow-xl flex items-center gap-2 text-gray-200 hover:text-white transition-all hover:scale-105"
          title="Clean up isolated nodes"
        >
          <span className="text-lg">✂️</span>
          <span className="font-semibold text-sm">Prune</span>
        </button>
      </div>

      {/* Search Terminal Overlays */}
      {searchProgress.isSearching && (
        <div className="absolute bottom-6 left-6 z-30 w-80">
          <div className="bg-black/90 backdrop-blur-md border border-green-500/50 rounded-xl p-4 shadow-2xl font-mono text-xs text-green-400">
            <div className="flex justify-between items-center mb-2 border-b border-green-500/30 pb-2">
              <span className="animate-pulse flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                SEARCHING MATRIX
              </span>
              <span>{searchProgress.exploredCount} nodes</span>
            </div>
            <div className="space-y-1 h-32 overflow-hidden flex flex-col justify-end">
              {searchLog.map((log, i) => (
                <div key={i} className="truncate opacity-80 border-l border-green-500/20 pl-2">{log}</div>
              ))}
            </div>
            <button
              onClick={cancelSearch}
              className="mt-3 w-full border border-red-900 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded px-2 py-1 text-center transition"
            >
              ABORT SEQUENCE
            </button>
          </div>
        </div>
      )}

      {!searchProgress.isSearching && (
        <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
          <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/30 rounded-full px-4 py-2 text-xs text-gray-400 flex gap-4 shadow-lg">
            <span>Nodes: <strong className="text-gray-200">{nodeCount}</strong></span>
            <span>Connections: <strong className="text-gray-200">{linkCount}</strong></span>
          </div>
        </div>
      )}

      {/* Floating Node Details - Side Panel */}
      {clickedNode && (
        <div className="absolute top-6 right-6 z-30 w-80 max-w-[90vw]">
          <div className="bg-gray-800/95 backdrop-blur-xl border border-gray-600/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-right">
            <div className="relative h-40 bg-gray-900 skeleton-loader">
              {clickedThumbnail ? (
                <img src={clickedThumbnail} alt={clickedNode.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl font-serif italic">W</div>
              )}
              <button onClick={() => setClickedNode(null)} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-1 text-white backdrop-blur-sm transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-5">
              <h2 className="text-xl font-bold text-white mb-2 leading-tight">{clickedNode.title}</h2>
              <p className="text-sm text-gray-300 mb-4 leading-relaxed max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pr-2">
                {clickedSummary || 'Loading summary...'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(clickedNode.title)}`, '_blank')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-xs font-medium transition">Read Article ↗</button>
                <button onClick={() => expandNode(clickedNode.id)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-medium transition shadow-lg shadow-indigo-500/20">Expand</button>
              </div>
              <button onClick={() => deleteNodeImperative(clickedNode.id)} className="mt-3 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl text-xs transition border border-red-500/20">Remove from Graph</button>
            </div>
          </div>
        </div>
      )}

      {/* Link Context Dialog */}
      {clickedLink && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 max-w-lg w-full p-4 animate-pop-in">
          <div className="bg-gray-900/95 backdrop-blur-2xl border border-green-500/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <button onClick={() => setClickedLink(null)} className="absolute top-4 right-4 p-2 bg-gray-800/50 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition" title="Close"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-green-900/50">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-1">Connection Verification</h3>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{typeof clickedLink.source === 'object' ? clickedLink.source.title : clickedLink.source}</span>
                    <span className="text-gray-500 text-sm">linked to</span>
                    <span>{typeof clickedLink.target === 'object' ? clickedLink.target.title : clickedLink.target}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                  <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-2 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>Evidence (Source Text)</h4>
                  <p className="text-sm text-gray-200 italic leading-relaxed font-serif border-l-2 border-blue-500/50 pl-3">"{clickedLink.context || 'Context text unavailable via API.'}"</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1">Determination Method</h4>
                    <p className="text-xs text-gray-300">Direct Hyperlink in Source Article</p>
                  </div>
                  <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                    <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1">Link Type</h4>
                    <p className="text-xs text-gray-300 capitalize">{clickedLink.type || 'Manual'} Connection</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WikiWebExplorer;
