import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const WikiWebExplorer = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [clickedNode, setClickedNode] = useState(null);
  const [clickedSummary, setClickedSummary] = useState('');
  const [clickedThumbnail, setClickedThumbnail] = useState('');
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [pathNodes, setPathNodes] = useState(new Set());
  const [userTypedNodes, setUserTypedNodes] = useState(new Set());
  const [autoDiscoveredNodes, setAutoDiscoveredNodes] = useState(new Set());
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [nodeThumbnails, setNodeThumbnails] = useState({});
  const [searchProgress, setSearchProgress] = useState({
    isSearching: false,
    currentDepth: 0,
    maxDepth: 6,
    currentPage: '',
    exploredCount: 0,
    queueSize: 0,
    exploredNodes: new Set(),
  });
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const cacheRef = useRef({});
  const transformRef = useRef(d3.zoomIdentity);
  const searchAbortRef = useRef(false);

  // Visual settings
  const pathThickness = 4; // Fixed path thickness
  const [nodeSpacing, setNodeSpacing] = useState(150);

  // Fetch Wikipedia links from intro section (most relevant links)
  const fetchWikiLinks = async (title) => {
    if (cacheRef.current[title]) {
      return cacheRef.current[title];
    }

    try {
      // Use parse API with section=0 to get only intro links (most relevant)
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
          title
        )}&prop=links&section=0&format=json&origin=*&redirects=1`
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.parse || !data.parse.links) {
        throw new Error('Invalid API response');
      }

      // Filter to article links only and take first 20
      const links = data.parse.links
        .filter(link => link.ns === 0)  // namespace 0 = articles only
        .map(link => link['*'])
        .slice(0, 20);

      cacheRef.current[title] = links;
      return links;
    } catch (err) {
      console.error('Fetch error:', err);
      throw new Error(`Failed to fetch links: ${err.message}`);
    }
  };

  // Fetch Wikipedia summary and thumbnail
  const fetchSummary = async (title) => {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        return { summary: 'Summary not available', thumbnail: null };
      }

      const data = await response.json();

      // Cache thumbnail if available
      if (data.thumbnail?.source) {
        setNodeThumbnails(prev => ({
          ...prev,
          [title]: data.thumbnail.source
        }));
      }

      return {
        summary: data.extract || 'No summary available',
        thumbnail: data.thumbnail?.source || null
      };
    } catch (err) {
      console.error('Summary fetch error:', err);
      return { summary: 'Failed to load summary', thumbnail: null };
    }
  };

  // Add topic to graph with auto-connection to existing nodes
  const addTopic = async (title) => {
    if (!title.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const links = await fetchWikiLinks(title);

      // Fetch thumbnail for the user-typed node
      await fetchSummary(title);

      // Mark this as a user-typed node
      setUserTypedNodes(prev => new Set([...prev, title]));

      setGraphData(prev => {
        const existingNode = prev.nodes.find(n => n.id === title);
        if (existingNode) {
          return prev;
        }

        const newNodes = [...prev.nodes, { id: title, title }];
        const newLinks = [...prev.links];
        const newAutoDiscovered = new Set();

        // Add links from new topic to its connected pages (as auto-discovered)
        links.forEach(link => {
          const linkNode = newNodes.find(n => n.id === link);
          if (!linkNode) {
            newNodes.push({ id: link, title: link });
            newAutoDiscovered.add(link);
          }

          if (!newLinks.find(l => l.source === title && l.target === link)) {
            newLinks.push({ source: title, target: link });
          }
        });

        // Update auto-discovered nodes
        setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));

        // Auto-connect: check if existing nodes link to this new topic
        prev.nodes.forEach(existingNode => {
          const cachedLinks = cacheRef.current[existingNode.id];
          if (cachedLinks && cachedLinks.includes(title)) {
            // Create connection from existing node to new topic
            if (!newLinks.find(l => l.source === existingNode.id && l.target === title)) {
              newLinks.push({ source: existingNode.id, target: title });
            }
          }
        });

        return { nodes: newNodes, links: newLinks };
      });

      setSearchTerm('');
    } catch (err) {
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

  // BFS pathfinding with discovered nodes added to map
  const findPath = async (start, end) => {
    const startTime = Date.now();
    console.log(`[PathFinder] 🚀 Starting BFS from "${start}" to "${end}"`);

    searchAbortRef.current = false;
    setLoading(true);
    setError('');
    setPathNodes(new Set());

    setSearchProgress({
      isSearching: true,
      currentDepth: 0,
      maxDepth: 6,
      currentPage: start,
      exploredCount: 0,
      queueSize: 1,
      exploredNodes: new Set([start]),
    });

    try {
      const queue = [[start]];
      const visited = new Set([start]);
      const maxDepth = 6;
      const exploredNodes = new Set([start]);
      let exploredCount = 0;

      while (queue.length > 0 && !searchAbortRef.current) {
        const path = queue.shift();
        const current = path[path.length - 1];
        const currentDepth = path.length;

        exploredCount++;

        // Update progress
        setSearchProgress(prev => ({
          ...prev,
          currentDepth,
          currentPage: current,
          exploredCount,
          queueSize: queue.length,
        }));

        console.log(`[PathFinder] 📍 Depth ${currentDepth}: Exploring "${current}" (${exploredCount} pages searched, ${queue.length} in queue)`);

        if (currentDepth > maxDepth) {
          console.log(`[PathFinder] ⚠️ Max depth ${maxDepth} reached`);
          setError(`No path found within ${maxDepth} steps`);
          break;
        }

        if (current.toLowerCase() === end.toLowerCase()) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`[PathFinder] ✅ SUCCESS! Path found in ${path.length} steps`);
          console.log(`[PathFinder] 🛤️  Path: ${path.join(' → ')}`);
          console.log(`[PathFinder] 📊 Stats: ${exploredCount} pages explored in ${duration}s`);

          setSearchProgress(prev => ({
            ...prev,
            isSearching: false,
            exploredNodes,
          }));

          setPathNodes(new Set(path));
          setError(`Path found: ${path.join(' → ')}`);
          setLoading(false);
          return;
        }

        const links = await fetchWikiLinks(current);
        console.log(`[PathFinder] 🔗 Found ${links.length} links from "${current}": [${links.slice(0, 5).join(', ')}${links.length > 5 ? '...' : ''}]`);

        // Add discovered nodes to the graph in real-time
        setGraphData(prev => {
          const newNodes = [...prev.nodes];
          const newLinks = [...prev.links];
          const newAutoDiscovered = new Set();

          links.forEach(link => {
            if (!visited.has(link)) {
              visited.add(link);
              exploredNodes.add(link);
              queue.push([...path, link]);

              // Add to graph if not already present
              if (!newNodes.find(n => n.id === link)) {
                newNodes.push({ id: link, title: link });
                newAutoDiscovered.add(link);
              }

              // Add edge if not present
              if (!newLinks.find(l => l.source === current && l.target === link)) {
                newLinks.push({ source: current, target: link });
              }
            }
          });

          // Update auto-discovered nodes
          if (newAutoDiscovered.size > 0) {
            setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));
          }

          return { nodes: newNodes, links: newLinks };
        });

        // Small delay to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (searchAbortRef.current) {
        console.log('[PathFinder] 🛑 Search aborted by user');
        setSearchProgress(prev => ({ ...prev, isSearching: false }));
        setLoading(false);
        return;
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[PathFinder] ❌ No path found after exploring ${exploredCount} pages in ${duration}s`);

      if (!error) {
        setError('No path found between selected nodes');
      }

      setSearchProgress(prev => ({
        ...prev,
        isSearching: false,
        exploredNodes,
      }));

    } catch (err) {
      console.error('[PathFinder] 💥 Error:', err);
      setError(err.message || 'Failed to find path');
      setSearchProgress(prev => ({ ...prev, isSearching: false }));
    } finally {
      setLoading(false);
    }
  };

  // Expand node: fetch and add its links as sub-web
  const expandNode = async (title) => {
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

    setLoading(true);
    try {
      const links = await fetchWikiLinks(title);
      console.log(`[Expand] ➕ Adding ${links.length} sub-nodes for "${title}"`);

      setGraphData(prev => {
        const newNodes = [...prev.nodes];
        const newLinks = [...prev.links];
        const newAutoDiscovered = new Set();

        links.forEach(link => {
          // Add node if not present
          if (!newNodes.find(n => n.id === link)) {
            newNodes.push({ id: link, title: link });
            newAutoDiscovered.add(link);
          }

          // Add edge if not present
          if (!newLinks.find(l => l.source === title && l.target === link)) {
            newLinks.push({ source: title, target: link });
          }
        });

        // Update auto-discovered nodes
        if (newAutoDiscovered.size > 0) {
          setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));
        }

        return { nodes: newNodes, links: newLinks };
      });

      // Mark as expanded
      setExpandedNodes(prev => new Set([...prev, title]));
    } catch (err) {
      console.error('[Expand] Error:', err);
      setError(`Failed to expand ${title}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle node interactions with new UX
  const handleNodeClick = async (event, d) => {
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
    setClickedNode(d);
    const result = await fetchSummary(d.title);
    setClickedSummary(result.summary);
    setClickedThumbnail(result.thumbnail || '');
  };

  // Handle double-click: Expand node
  const handleNodeDoubleClick = (event, d) => {
    event.stopPropagation();
    console.log(`[Click] 🔄 Double-clicked "${d.title}" - expanding`);
    expandNode(d.id);
  };

  // D3 visualization
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        transformRef.current = event.transform;
      });

    svg.call(zoom);
    svg.call(zoom.transform, transformRef.current);

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(nodeSpacing))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(45));

    simulationRef.current = simulation;

    const link = g.append('g')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', d => {
        // Check if this link is part of the path
        const sourceInPath = pathNodes.has(d.source.id || d.source);
        const targetInPath = pathNodes.has(d.target.id || d.target);
        return (sourceInPath && targetInPath) ? '#00ff88' : '#444';
      })
      .attr('stroke-width', d => {
        const sourceInPath = pathNodes.has(d.source.id || d.source);
        const targetInPath = pathNodes.has(d.target.id || d.target);
        return (sourceInPath && targetInPath) ? pathThickness : 1;
      })
      .attr('stroke-opacity', 0.6);

    let dragStartPos = null;
    const dragThreshold = 5; // pixels to move before considered a drag

    const node = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .call(d3.drag()
        .on('start', (event, d) => {
          dragStartPos = { x: event.x, y: event.y };
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          // Only actually drag if moved more than threshold
          const dx = event.x - dragStartPos.x;
          const dy = event.y - dragStartPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > dragThreshold) {
            event.sourceEvent.preventDefault(); // Prevent click if dragging
            d.fx = event.x;
            d.fy = event.y;
          }
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);

          // Check if this was a real drag or just a click
          const dx = event.x - dragStartPos.x;
          const dy = event.y - dragStartPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > dragThreshold) {
            // Real drag - release node
            d.fx = null;
            d.fy = null;
          } else {
            // Just a click - keep node position but don't prevent click event
            d.fx = null;
            d.fy = null;
          }
        }));

    // Sanitize ID for use in CSS selectors (remove special characters)
    const sanitizeId = (id) => {
      return id.replace(/[^a-zA-Z0-9-_]/g, '_');
    };

    // Add SVG defs for image patterns
    const defs = svg.select('defs').size() > 0 ? svg.select('defs') : svg.append('defs');

    graphData.nodes.forEach(d => {
      const thumbnail = nodeThumbnails[d.id];
      if (thumbnail) {
        const patternId = `img-${sanitizeId(d.id)}`;
        defs.selectAll(`#${patternId}`).remove(); // Remove old pattern if exists
        const pattern = defs.append('pattern')
          .attr('id', patternId)
          .attr('width', 1)
          .attr('height', 1)
          .attr('patternContentUnits', 'objectBoundingBox');

        pattern.append('image')
          .attr('href', thumbnail)
          .attr('width', 1)
          .attr('height', 1)
          .attr('preserveAspectRatio', 'xMidYMid slice');
      }
    });

    // Add circles with optional image backgrounds
    node.each(function(d) {
      const nodeGroup = d3.select(this);
      const thumbnail = nodeThumbnails[d.id];
      const patternId = `img-${sanitizeId(d.id)}`;

      // Background circle with image if available
      if (thumbnail) {
        nodeGroup.append('circle')
          .attr('r', 30)
          .attr('fill', `url(#${patternId})`)
          .attr('fill-opacity', 0.4);
      }

      // Overlay colored circle
      nodeGroup.append('circle')
        .attr('r', 30)
        .attr('fill', () => {
          if (pathNodes.has(d.id)) return '#00ff88'; // Green for path
          if (d.id === searchProgress.currentPage && searchProgress.isSearching) return '#ffdd00'; // Yellow for currently exploring
          if (selectedNodes.some(n => n.id === d.id)) return '#ff8800'; // Orange for selected
          if (userTypedNodes.has(d.id)) return '#0088ff'; // Blue for user-typed
          if (autoDiscoveredNodes.has(d.id)) return '#9966ff'; // Purple for auto-discovered
          return '#0088ff'; // Default blue
        })
        .attr('fill-opacity', thumbnail ? 0.3 : 1)
        .attr('stroke', () => {
          if (selectedNodes.some(n => n.id === d.id)) return '#ffff00'; // Yellow stroke for selected
          if (d.id === searchProgress.currentPage && searchProgress.isSearching) return '#ff6600'; // Orange stroke for exploring
          if (expandedNodes.has(d.id)) return '#00ffff'; // Cyan for expanded
          return '#fff';
        })
        .attr('stroke-width', () => {
          if (d.id === searchProgress.currentPage && searchProgress.isSearching) return 4;
          if (selectedNodes.some(n => n.id === d.id)) return 3;
          if (expandedNodes.has(d.id)) return 3;
          return 2;
        });
    });

    // Text wrapping function
    node.each(function(d) {
      const textElement = d3.select(this).append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none');

      const words = d.title.split(/\s+/);
      const maxCharsPerLine = 10;
      const maxLines = 3;
      let lines = [];
      let currentLine = '';

      // Build lines
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Limit to maxLines and add ellipsis if needed
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = lines[maxLines - 1].substring(0, maxCharsPerLine - 2) + '...';
      }

      // Calculate vertical offset to center multi-line text
      const lineHeight = 10;
      const totalHeight = lines.length * lineHeight;
      const startY = -(totalHeight / 2) + (lineHeight / 2);

      // Add tspan for each line
      lines.forEach((line, i) => {
        textElement.append('tspan')
          .attr('x', 0)
          .attr('y', startY + (i * lineHeight))
          .text(line);
      });
    });

    node
      .on('click', handleNodeClick)
      .on('dblclick', handleNodeDoubleClick)
      .style('cursor', 'pointer');

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, selectedNodes, pathNodes, searchProgress, userTypedNodes, autoDiscoveredNodes, expandedNodes, nodeThumbnails, nodeSpacing]);

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold mb-4 text-blue-400">WikiWeb Explorer</h1>
        
        {/* Search Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTopic(searchTerm)}
            placeholder="Enter Wikipedia topic..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => addTopic(searchTerm)}
            disabled={loading || !searchTerm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition"
          >
            Explore
          </button>
        </div>

        {/* Visual Controls */}
        <div className="mt-3 text-xs">
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
          />
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
      <div className="flex-1 relative">
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
                Open in Wikipedia
              </button>
              <button
                onClick={() => expandNode(clickedNode.id)}
                className="flex-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              >
                Expand Node
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {graphData.nodes.length === 0 && !loading && (
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

        {/* Color Legend */}
        {graphData.nodes.length > 0 && (
          <div className="absolute bottom-4 right-4 bg-gray-800 border border-gray-700 rounded p-3 shadow-lg text-xs">
            <h4 className="font-bold text-gray-300 mb-2">Node Colors</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <span className="text-gray-400">User-typed topics</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#9966ff' }}></div>
                <span className="text-gray-400">Auto-discovered</span>
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
                <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: '#00ffff' }}></div>
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
        <span>{graphData.nodes.length} nodes • {graphData.links.length} connections</span>
        <span>Cached: {Object.keys(cacheRef.current).length} topics</span>
      </div>
    </div>
  );
};

export default WikiWebExplorer;