import { useState, useEffect, useRef } from 'react';
import { GraphManager, Node as GraphNode, Link } from './GraphManager';
import { UpdateQueue } from './UpdateQueue';
import { WikiService } from './WikiService';
import { connectionLogger } from './ConnectionLogger';
import LogPanel from './components/LogPanel';
import './index.css';

const WikiWebExplorer = () => {
  // UI state only
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [linkCount, setLinkCount] = useState<number>(0);
  const [clickedNode, setClickedNode] = useState<GraphNode | null>(null);
  const [clickedSummary, setClickedSummary] = useState('');
  const [clickedThumbnail, setClickedThumbnail] = useState('');
  const [selectedNodes, setSelectedNodes] = useState<GraphNode[]>([]);
  const [pathNodes, setPathNodes] = useState(new Set<string>());
  const [userTypedNodes, setUserTypedNodes] = useState(new Set<string>());
  const [autoDiscoveredNodes, setAutoDiscoveredNodes] = useState(new Set<string>());
  const [recentlyAddedNodes, setRecentlyAddedNodes] = useState(new Set<string>());
  const [expandedNodes, setExpandedNodes] = useState(new Set<string>());
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [nodeThumbnails, setNodeThumbnails] = useState<Record<string, string>>({});
  const [searchProgress, setSearchProgress] = useState({
    isSearching: false,
    currentDepth: 0,
    maxDepth: 6,
    currentPage: '',
    exploredCount: 0,
    queueSize: 0,
    exploredNodes: new Set<string>(),
  });

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const graphManagerRef = useRef<GraphManager | null>(null);
  const updateQueueRef = useRef<UpdateQueue | null>(null);
  const searchAbortRef = useRef(false);

  // Visual settings
  const [nodeSpacing, setNodeSpacing] = useState(150);
  const [searchDepth, setSearchDepth] = useState(2); // Depth for purple node branching during search

  // Initialize GraphManager once
  useEffect(() => {
    if (!svgRef.current || graphManagerRef.current) return;

    console.log('[GraphManager] Initializing...');

    graphManagerRef.current = new GraphManager(svgRef.current, {
      onNodeClick: (node, event) => handleNodeClick(event as any, node),
      onNodeDoubleClick: (node, event) => handleNodeDoubleClick(event as any, node),
      onNodeDragEnd: (node, isOverTrash) => {
        if (isOverTrash) {
          console.log(`[Drag] 🗑️ Node "${node.id}" dropped on trash`);
          deleteNodeImperative(node.id);
        }
        setIsOverTrash(false);
      },
      onStatsUpdate: (stats) => {
        setNodeCount(stats.nodeCount);
        setLinkCount(stats.linkCount);
      },
    });

    updateQueueRef.current = new UpdateQueue(graphManagerRef.current, 500);

    console.log('[GraphManager] Initialized successfully');

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

  // Update node spacing when slider changes
  useEffect(() => {
    if (graphManagerRef.current) {
      graphManagerRef.current.setNodeSpacing(nodeSpacing);
    }
  }, [nodeSpacing]);

  // Sync node metadata to GraphManager when sets change
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

  // -- Refactored to use WikiService --

  // Add topic to graph with auto-connection to existing nodes
  const addTopic = async (title: string) => {
    if (!title.trim()) {
      setError('Please enter a topic');
      return;
    }

    if (!updateQueueRef.current) {
      console.error('UpdateQueue not initialized');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const links = await WikiService.fetchLinks(title);

      // Fetch thumbnail for the user-typed node
      const summaryData = await WikiService.fetchSummary(title);
      if (summaryData.thumbnail) {
        setNodeThumbnails(prev => ({ ...prev, [title]: summaryData.thumbnail! }));
      }

      // Mark this as a user-typed node
      setUserTypedNodes(prev => new Set([...prev, title]));

      // Prepare nodes and links
      const newNodes: GraphNode[] = [{ id: title, title }];
      const newLinks: Link[] = [];
      const newAutoDiscovered = new Set<string>();

      // Add links from new topic to its connected pages (as auto-discovered)
      links.forEach((link: string) => {
        newNodes.push({ id: link, title: link });
        newAutoDiscovered.add(link);
        newLinks.push({ source: title, target: link });
        connectionLogger.log(title, link, 'manual');
      });

      // Update auto-discovered nodes
      setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));

      // Auto-connect: check if existing nodes link to this new topic
      const stats = graphManagerRef.current?.getStats();
      if (stats && stats.nodeCount > 0) {
        // Check cached links for existing nodes for reverse connections
        WikiService.getCachedNodes().forEach(existingNodeId => {
          const cachedLinks = WikiService.getLinksFromCache(existingNodeId);
          if (cachedLinks && cachedLinks.includes(title)) {
            // Avoid duplicates if graph already has it? GraphManager handles idempotency mostly
            newLinks.push({ source: existingNodeId, target: title });
            connectionLogger.log(existingNodeId, title, 'auto');
          }
        });
      }


      // Queue the update
      updateQueueRef.current.queueUpdate(newNodes, newLinks);

      setSearchTerm('');
    } catch (err: any) {
      console.error('Add topic error:', err);
      setError(err.message || 'Failed to fetch Wikipedia data');
    } finally {
      setLoading(false);
    }
  };

  // Cancel search
  const cancelSearch = () => {
    console.log('[PathFinder] 🛑 Search cancelled by user');
    searchAbortRef.current = true;
    setError('Search cancelled');
  };

  // Delete node using GraphManager
  const deleteNodeImperative = (nodeId: string) => {
    console.log(`[Delete] 🗑️ Deleting node "${nodeId}"`);

    if (graphManagerRef.current) {
      graphManagerRef.current.deleteNode(nodeId);
    }

    // Clean up from React state sets
    setUserTypedNodes(prev => {
      const updated = new Set(prev);
      updated.delete(nodeId);
      return updated;
    });
    setAutoDiscoveredNodes(prev => {
      const updated = new Set(prev);
      updated.delete(nodeId);
      return updated;
    });
    setExpandedNodes(prev => {
      const updated = new Set(prev);
      updated.delete(nodeId);
      return updated;
    });
    setPathNodes(prev => {
      const updated = new Set(prev);
      updated.delete(nodeId);
      return updated;
    });

    // Clear clicked node if it was deleted
    if (clickedNode?.id === nodeId) {
      setClickedNode(null);
    }
  };

  // Prune graph (remove leaf nodes)
  const pruneGraph = () => {
    console.log('[Prune] ✂️ Pruning graph...');
    if (graphManagerRef.current) {
      const deletedCount = graphManagerRef.current.pruneNodes();
      console.log(`[Prune] Deleted ${deletedCount} nodes`);
      if (deletedCount > 0) {
        setError(`Pruned ${deletedCount} isolated nodes`);
        // Clear error message after 3 seconds
        setTimeout(() => setError(''), 3000);
      } else {
        setError('No isolated nodes found to prune');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  // Clean BFS pathfinding - only loads nodes on success
  const findPath = async (startTitle: string, endTitle: string) => {
    console.log(`[PathFinder] 🔍 Starting CLEAN path search: "${startTitle}" -> "${endTitle}"`);

    // Reset state
    setSearchProgress({
      isSearching: true,
      currentDepth: 0,
      maxDepth: 6,
      exploredCount: 0,
      currentPage: startTitle,
      queueSize: 1,
      exploredNodes: new Set([startTitle])
    });
    setLoading(true);
    setPathNodes(new Set());
    setError('');
    searchAbortRef.current = false;

    // Internal BFS State
    const queue: { title: string; depth: number }[] = [{ title: startTitle, depth: 0 }];
    const visited = new Set<string>([startTitle]);
    const parentMap = new Map<string, string>(); // child -> parent

    let nodesExplored = 0;
    const MAX_NODES = 500; // Safety limit
    const startTime = Date.now();

    try {
      while (queue.length > 0) {
        if (searchAbortRef.current) {
          console.log('[PathFinder] 🛑 Search aborted by user');
          break;
        }

        const { title, depth } = queue.shift()!;

        // Update progress UI sporadically
        nodesExplored++;
        if (nodesExplored % 5 === 0) {
          setSearchProgress(prev => ({
            ...prev,
            exploredCount: nodesExplored,
            currentDepth: depth,
            currentPage: title,
            queueSize: queue.length
          }));
          // Yield to UI
          await new Promise(r => setTimeout(r, 0));
        }

        if (depth >= 6) continue;
        if (nodesExplored > MAX_NODES) {
          throw new Error(`Exceeded exploration limit (${MAX_NODES} nodes) without finding target.`);
        }

        // Fetch links
        const links = await WikiService.fetchLinks(title);

        for (const link of links) {
          if (visited.has(link)) continue;

          // Found?
          if (link === endTitle) {
            console.log(`[PathFinder] 🎉 FOUND PATH!`);
            parentMap.set(link, title);

            // Reconstruct Path
            const path: string[] = [endTitle];
            let curr = endTitle;
            while (curr !== startTitle) {
              const p = parentMap.get(curr)!;
              path.unshift(p);
              curr = p;
            }
            console.log('[PathFinder] Path:', path.join(' -> '));

            // Add path nodes to graph
            const newNodes = path.map(p => ({ id: p, title: p }));

            // Add path links
            const newLinks: Link[] = [];
            for (let i = 0; i < path.length - 1; i++) {
              newLinks.push({ source: path[i], target: path[i + 1] });
              // Log valid connection
              connectionLogger.log(path[i], path[i + 1], 'path');
            }

            // Update GraphManager
            if (graphManagerRef.current) {
              graphManagerRef.current.addNodes(newNodes);
              graphManagerRef.current.addLinks(newLinks);

              // Sets metadata for path highlighting
              setPathNodes(new Set(path));

              const updates = path.map(p => ({
                nodeId: p,
                metadata: { isInPath: true }
              }));
              graphManagerRef.current.setNodesMetadata(updates);

              // Force highight path nodes (undim them if dimmed)
              graphManagerRef.current.highlightNode(null); // Reset global dim
            }

            setSearchProgress(prev => ({ ...prev, isSearching: false }));
            setLoading(false);
            return; // Done
          }

          visited.add(link);
          parentMap.set(link, title);
          queue.push({ title: link, depth: depth + 1 });
        }
      }

      // If loop finishes without return -> Not Found or Aborted
      if (!searchAbortRef.current) {
        setError('No path found within search limits.');
      }

    } catch (err: any) {
      console.error('[PathFinder] Error:', err);
      setError(err.message || 'Error during pathfinding');
    } finally {
      setLoading(false);
      setSearchProgress(prev => ({ ...prev, isSearching: false }));
    }
  };





  // Expand node: fetch and add its links as sub-web
  const expandNode = async (title: string) => {
    console.log(`[Expand] 🌐 Expanding node "${title}"`);

    // Check if already expanded - if so, toggle off
    if (expandedNodes.has(title)) {
      console.log(`[Expand] ➖ Collapsing "${title}"`);
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(title);
        return newSet;
      });
      // Note: We keep the nodes on the graph, just remove the expanded indicator
      return;
    }

    if (!updateQueueRef.current) {
      console.error('UpdateQueue not initialized');
      return;
    }

    setLoading(true);
    try {
      const links = await WikiService.fetchLinks(title);
      console.log(`[Expand] ➕ Adding ${links.length} sub-nodes for "${title}"`);

      const nodesToAdd: GraphNode[] = [];
      const linksToAdd: Link[] = [];
      const newAutoDiscovered = new Set<string>();

      links.forEach((link: string) => {
        nodesToAdd.push({ id: link, title: link });
        newAutoDiscovered.add(link);
        linksToAdd.push({ source: title, target: link });
        connectionLogger.log(title, link, 'expand');
      });

      // Update auto-discovered nodes
      if (newAutoDiscovered.size > 0) {
        setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));
      }

      // Queue the update
      updateQueueRef.current.queueUpdate(nodesToAdd, linksToAdd);

      // Mark as expanded
      setExpandedNodes(prev => new Set([...prev, title]));
    } catch (err: any) {
      console.error('[Expand] Error:', err);
      setError(`Failed to expand ${title}`);
    } finally {
      setLoading(false);
    }
  };

  // Smart Expand: Prioritize adding nodes that are already linked to by other nodes in the graph
  // or that link back to existing nodes (triangulation).
  const smartExpandNode = async (title: string) => {
    console.log(`[Smart Expand] 🧠 Analyzing connections for "${title}"`);
    setLoading(true);

    try {
      // 1. Get all links from this node
      const links = await WikiService.fetchLinks(title);

      // 2. Identify which of these potential new nodes are MOST relevant
      // Relevance score = number of existing nodes that ALSO link to this candidate
      // OR existing nodes that this candidate links TO (harder to know without fetching)

      // Get all currently visible nodes
      const existingNodes = WikiService.getCachedNodes();

      // Candidate scores
      const scores: Record<string, number> = {};

      // A. Check if candidate is already in the graph (Score +100 - immediate connection)
      // B. Check if existing nodes link to this candidate (Score +10 per connection)

      links.forEach(candidate => {
        scores[candidate] = 0;

        // If already in graph, it's a direct link we missed? (Usually auto-added, but good to ensure)
        if (graphManagerRef.current?.getStats().nodeCount) {
          // Logic to check if node exists in D3 is needed, or use our sets
          // We can check if `cache[candidate]` exists, meaning we visited it.
          if (WikiService.getLinksFromCache(candidate)) {
            scores[candidate] += 100;
          }
        }

        // Check reverse connections from other existing nodes
        existingNodes.forEach(existing => {
          if (existing === title) return;
          const existingLinks = WikiService.getLinksFromCache(existing);
          if (existingLinks && existingLinks.includes(candidate)) {
            scores[candidate] += 10;
          }
        });
      });

      // Filter to top candidates
      const sortedCandidates = links
        .sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
        .slice(0, 15); // Take top 15 most relevant

      console.log(`[Smart Expand] Top candidates for ${title}:`, sortedCandidates.map(c => `${c} (${scores[c]})`));

      // Add them
      const nodesToAdd: GraphNode[] = [];
      const linksToAdd: Link[] = [];
      const newAutoDiscovered = new Set<string>();

      sortedCandidates.forEach(link => {
        // Add node
        nodesToAdd.push({ id: link, title: link });
        newAutoDiscovered.add(link);

        // Add link from source
        linksToAdd.push({ source: title, target: link });
        connectionLogger.log(title, link, 'expand', scores[link] > 0 ? 2 : 1);

        // Add links from RELEVANT existing nodes (triangulation)
        existingNodes.forEach(existing => {
          const existingLinks = WikiService.getLinksFromCache(existing);
          if (existingLinks && existingLinks.includes(link)) {
            linksToAdd.push({ source: existing, target: link });
            connectionLogger.log(existing, link, 'auto', 2);
          }
        });
      });

      if (nodesToAdd.length === 0) {
        setError('No relevant connections found to add.');
      } else {
        if (updateQueueRef.current) {
          updateQueueRef.current.queueUpdate(nodesToAdd, linksToAdd);
        }
        if (newAutoDiscovered.size > 0) {
          setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));
        }
        setExpandedNodes(prev => new Set([...prev, title]));
      }

    } catch (err: any) {
      console.error('[Smart Expand] Error:', err);
      setError(`Failed to smart expand ${title}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle node interactions with new UX
  const handleNodeClick = async (event: any, d: GraphNode) => {
    // Ignore if this was a drag event
    if (event.defaultPrevented) return;

    event.stopPropagation();

    // Ctrl+Click: Open Wikipedia
    if (event.ctrlKey || event.metaKey) {
      console.log(`[Click] 🌐 Opening Wikipedia for "${d.title}"`);
      window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}`, '_blank');
      return;
    }

    // Shift+Click: Select for pathfinding
    if (event.shiftKey) {
      console.log(`[Click] ✅ Selecting "${d.title}" for pathfinding`);
      setSelectedNodes(prev => {
        const newSelection = [...prev];
        const index = newSelection.findIndex(n => n.id === d.id);

        if (index >= 0) {
          // Deselect
          newSelection.splice(index, 1);
          setPathNodes(new Set());
          setError('');
        } else {
          // Select
          newSelection.push(d);
          if (newSelection.length > 2) {
            newSelection.shift(); // Keep only last 2
          }
        }

        // If we have 2 nodes selected, find path
        if (newSelection.length === 2) {
          findPath(newSelection[0].id, newSelection[1].id);
        } else {
          setPathNodes(new Set());
          setError('');
        }

        return newSelection;
      });
      return;
    }

    // Single Click: Show persistent summary panel
    console.log(`[Click] 📖 Showing summary for "${d.title}"`);

    // Highlight node and connections
    if (graphManagerRef.current) {
      graphManagerRef.current.highlightNode(d.id);
    }

    setClickedNode(d);
    const result = await WikiService.fetchSummary(d.title);
    setClickedSummary(result.summary);
    setClickedThumbnail(result.thumbnail || '');
    if (result.thumbnail) {
      setNodeThumbnails(prev => ({ ...prev, [d.title]: result.thumbnail! }));
    }
  };

  // Handle double-click: Expand node
  const handleNodeDoubleClick = (event: any, d: GraphNode) => {
    event.stopPropagation();
    console.log(`[Click] 🔄 Double-clicked "${d.title}" - expanding`);
    expandNode(d.id);
  };


  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold mb-4 text-blue-400">WikiWeb Explorer</h1>

        {/* Search Bar */}
        <div className="flex gap-2 relative z-50">
          <div className="flex-1 relative">
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
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                // Small delay to allow clicking on suggestions
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              onKeyPress={(e) => e.key === 'Enter' && addTopic(searchTerm)}
              placeholder="Enter Wikipedia topic..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-xl max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm text-gray-200 transition"
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
          </div>
          <button
            onClick={() => addTopic(searchTerm)}
            disabled={loading || !searchTerm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition"
          >
            Explore
          </button>
        </div>

        {/* Visual Controls */}
        <div className="mt-3 text-xs grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-400 block mb-1">
              Node Spacing: {nodeSpacing}px
            </label>
            <input
              type="range"
              min="80"
              max="300"
              value={nodeSpacing}
              onChange={(e) => setNodeSpacing(Number(e.target.value))}
              className="w-full"
              aria-label="Node Spacing"
            />
          </div>
          <div>
            <label className="text-gray-400 block mb-1">
              Search Depth: {searchDepth} {searchDepth === 1 ? 'level' : 'levels'}
            </label>
            <input
              type="range"
              min="1"
              max="3"
              value={searchDepth}
              onChange={(e) => setSearchDepth(Number(e.target.value))}
              className="w-full"
              aria-label="Search Depth"
            />
          </div>
        </div>

        {/* Prune Tools */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={pruneGraph}
            className="px-3 py-1 bg-gray-700 hover:bg-red-900 text-gray-300 hover:text-red-200 rounded text-xs border border-gray-600 hover:border-red-700 transition-colors flex items-center gap-2"
            title="Remove nodes with fewer than 2 connections"
          >
            ✂️ Prune Isolated Nodes
          </button>
        </div>

        {/* Status Messages */}
        {loading && (
          <div className="mt-2 text-blue-400 text-sm flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            Loading...
          </div>
        )}
        {error && (
          <div className={`mt-2 text-sm ${error.startsWith('Path found') ? 'text-green-400' : 'text-red-400'}`}>
            {error}
          </div>
        )}
      </div>

      {/* Graph Visualization */}
      <div className="flex-1 relative bg-gray-900">
        <svg
          ref={svgRef}
          className="w-full h-full"
        />

        {/* Persistent Summary Panel (from click) */}
        {clickedNode && (
          <div className="absolute top-4 left-4 max-w-md bg-gray-800 border border-blue-500 rounded p-4 shadow-lg">
            <button
              onClick={() => setClickedNode(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <h3 className="font-bold text-blue-400 mb-3 pr-6">{clickedNode.title}</h3>
            {clickedThumbnail && (
              <img
                src={clickedThumbnail}
                alt={clickedNode.title}
                className="w-full h-40 object-cover rounded mb-3"
              />
            )}
            <p className="text-sm text-gray-300 mb-3">{clickedSummary || 'Loading summary...'}</p>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(clickedNode.title)}`, '_blank')}
                className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Open Wiki
              </button>
              <button
                onClick={() => expandNode(clickedNode.id)}
                className="flex-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              >
                Expand
              </button>
              <button
                onClick={() => smartExpandNode(clickedNode.id)}
                className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                title="Find connections to existing topics"
              >
                Smart Expand
              </button>
            </div>
            <button
              onClick={() => deleteNodeImperative(clickedNode.id)}
              className="mt-3 w-full px-3 py-1 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 rounded text-sm flex items-center justify-center gap-2"
            >
              🗑️ Delete Node
            </button>
          </div>
        )}

        {/* Instructions */}
        {nodeCount === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500 max-w-md">
              <h2 className="text-xl font-semibold mb-4">Welcome to WikiWeb Explorer</h2>
              <p className="mb-2">🔍 Search topics to build your knowledge graph</p>
              <p className="mb-2">🖱️ <strong>Click</strong> = Show summary panel</p>
              <p className="mb-2">🖱️ <strong>Double-click</strong> = Expand node's connections</p>
              <p className="mb-2">⌨️ <strong>Ctrl+Click</strong> = Open Wikipedia</p>
              <p className="mb-2">⌨️ <strong>Shift+Click</strong> two nodes = Find path</p>
              <p>🖱️ <strong>Drag</strong> nodes • <strong>Scroll</strong> to zoom</p>
            </div>
          </div>
        )}

        {/* Trash Can Zone */}
        <div
          className={`absolute bottom-4 left-4 w-32 h-32 rounded-lg border-4 transition-all ${isOverTrash
            ? 'bg-red-600 border-red-400 scale-110'
            : 'bg-gray-800 border-gray-600 hover:border-gray-500'
            }`}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <svg
              className={`w-16 h-16 transition-colors ${isOverTrash ? 'text-white' : 'text-gray-400'
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span className={`text-sm font-medium mt-2 ${isOverTrash ? 'text-white' : 'text-gray-400'}`}>
              Drag to Delete
            </span>
          </div>
        </div>

        {/* Connection Logs Panel */}
        <LogPanel />

        {/* Color Legend */}
        {nodeCount > 0 && (
          <div className="absolute bottom-4 right-4 bg-gray-800 border border-gray-700 rounded p-3 shadow-lg text-xs">
            <h4 className="font-bold text-gray-300 mb-2">Node Colors</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <span className="text-gray-400">User-typed topics</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#9966ff]"></div>
                <span className="text-gray-400">Auto-discovered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#ff00ff]"></div>
                <span className="text-gray-400">Newly added (2s)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-gray-400">Path connection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                <span className="text-gray-400">Currently exploring</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <span className="text-gray-400">Selected for path</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-[#00ffff]"></div>
                <span className="text-gray-400">Expanded node</span>
              </div>
            </div>
          </div>
        )}

        {/* Search Progress Panel */}
        {searchProgress.isSearching && (
          <div className="absolute top-4 left-4 bg-gray-800 border border-blue-500 rounded p-4 shadow-lg max-w-sm">
            <h3 className="font-bold text-blue-400 mb-3 flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
              Path Search in Progress
            </h3>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Depth {searchProgress.currentDepth} of {searchProgress.maxDepth}</span>
                <span>{Math.round((searchProgress.currentDepth / searchProgress.maxDepth) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(searchProgress.currentDepth / searchProgress.maxDepth) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Current Status */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Currently exploring:</span>
                <span className="text-yellow-400 font-semibold">{searchProgress.currentPage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pages explored:</span>
                <span className="text-white font-semibold">{searchProgress.exploredCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Queue size:</span>
                <span className="text-white font-semibold">{searchProgress.queueSize}</span>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              💡 Check browser console for detailed logs
            </div>

            {/* Cancel Button */}
            <button
              onClick={cancelSearch}
              className="mt-3 w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition text-sm font-semibold"
            >
              Cancel Search
            </button>
          </div>
        )}

        {/* Selected nodes indicator */}
        {selectedNodes.length > 0 && !searchProgress.isSearching && (
          <div className="absolute top-4 right-4 bg-gray-800 border border-orange-500 rounded p-3 shadow-lg">
            <h3 className="font-bold text-orange-400 mb-2">
              Selected ({selectedNodes.length}/2)
            </h3>
            {selectedNodes.map((node, i) => (
              <p key={node.id} className="text-sm text-gray-300">
                {i + 1}. {node.title}
              </p>
            ))}
            <p className="text-xs text-gray-500 mt-2">
              {selectedNodes.length === 1 ? 'Shift+Click another node' : 'Ready to search'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-xs text-gray-400 flex justify-between">
        <span>{nodeCount} nodes • {linkCount} connections</span>
        <span>Cached: {WikiService.getCachedNodes().length} topics</span>
      </div>
    </div>
  );
};

export default WikiWebExplorer;
