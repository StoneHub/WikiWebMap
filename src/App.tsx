import { useState, useEffect, useRef } from 'react';
import { GraphManager, Node as GraphNode, Link } from './GraphManager';
import { UpdateQueue } from './UpdateQueue';
import { WikiService, LinkWithContext } from './WikiService';
import './index.css';
import { SearchOverlay } from './components/SearchOverlay';
import { GraphControls } from './components/GraphControls';
import { NodeDetailsPanel } from './components/NodeDetailsPanel';
import { LinkContextPopup } from './components/LinkContextPopup';

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
  const [selectedNodes, setSelectedNodes] = useState<GraphNode[]>([]);
  const [pathNodes, setPathNodes] = useState(new Set<string>());
  const [userTypedNodes, setUserTypedNodes] = useState(new Set<string>());
  const [autoDiscoveredNodes, setAutoDiscoveredNodes] = useState(new Set<string>());
  const [recentlyAddedNodes] = useState(new Set<string>());
  const [expandedNodes, setExpandedNodes] = useState(new Set<string>());
  const [nodeThumbnails, setNodeThumbnails] = useState<Record<string, string>>({});

  // Link Context State
  const [activeLinkContexts, setActiveLinkContexts] = useState<Set<string>>(new Set());
  const [linkContextPositions, setLinkContextPositions] = useState<Record<string, { x: number, y: number }>>({});

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
  const animationFrameRef = useRef<number>();

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

    // Start tracking loop for link popups
    const trackPopups = () => {
      if (activeLinkContexts.size > 0 && graphManagerRef.current) {
        const newPositions: Record<string, { x: number, y: number }> = {};
        let hasChanges = false;

        activeLinkContexts.forEach(linkId => {
          const pos = graphManagerRef.current!.getLinkScreenCoordinates(linkId);
          if (pos) {
            newPositions[linkId] = pos;
            if (
              !linkContextPositions[linkId] ||
              Math.abs(linkContextPositions[linkId].x - pos.x) > 1 ||
              Math.abs(linkContextPositions[linkId].y - pos.y) > 1
            ) {
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          setLinkContextPositions(prev => ({ ...prev, ...newPositions }));
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
  }, [activeLinkContexts]); // Re-bind tracker if set size changes (optimization)

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
          id: `${resolvedTitle}-${linkObj.title}`,
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
            id: `${existingNodeId}-${resolvedTitle}`,
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
              newLinks.push({
                source,
                target,
                id: `${source}-${target}`,
                type: 'path',
                context
              });
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
      setSelectedNodes(prev => {
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
        onAddTopic={addTopic}
      />

      {/* Floating Controls */}
      <GraphControls
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        nodeSpacing={nodeSpacing}
        setNodeSpacing={setNodeSpacing}
        searchDepth={searchDepth}
        setSearchDepth={setSearchDepth}
        onPrune={pruneGraph}
        onRunAutoTest={runAutoTest}
      />

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
      <NodeDetailsPanel
        clickedNode={clickedNode}
        clickedSummary={clickedSummary}
        nodeThumbnails={nodeThumbnails}
        onClose={() => setClickedNode(null)}
        onExpand={expandNode}
        onDelete={deleteNodeImperative}
      />

      {/* Attached Link Contexts */}
      {Array.from(activeLinkContexts).map(linkId => {
        const position = linkContextPositions[linkId];
        const link = graphManagerRef.current?.getLinkBetween(linkId.split('-')[0], linkId.split('-')[1]);
        if (!position || !link) return null;

        return (
          <LinkContextPopup
            key={linkId}
            link={link}
            position={position}
            onClose={() => setActiveLinkContexts(prev => { const n = new Set(prev); n.delete(linkId); return n; })}
          />
        );
      })}

    </div>
  );
};

export default WikiWebExplorer;
