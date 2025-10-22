import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const WikiWebExplorer = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pathStart, setPathStart] = useState('');
  const [pathEnd, setPathEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [summary, setSummary] = useState('');
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const cacheRef = useRef({});
  const transformRef = useRef(d3.zoomIdentity);

  // Fetch Wikipedia links
  const fetchWikiLinks = async (title) => {
    if (cacheRef.current[title]) {
      return cacheRef.current[title];
    }

    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          title
        )}&prop=links&pllimit=20&format=json&origin=*&redirects=1`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.query || !data.query.pages) {
        throw new Error('Invalid API response');
      }
      
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      
      if (pageId === '-1') {
        throw new Error('Page not found');
      }

      const links = pages[pageId].links || [];
      const linkTitles = links.map(link => link.title);
      
      cacheRef.current[title] = linkTitles;
      return linkTitles;
    } catch (err) {
      console.error('Fetch error:', err);
      throw new Error(`Failed to fetch links: ${err.message}`);
    }
  };

  // Fetch Wikipedia summary
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
        return 'Summary not available';
      }
      
      const data = await response.json();
      return data.extract || 'No summary available';
    } catch (err) {
      console.error('Summary fetch error:', err);
      return 'Failed to load summary';
    }
  };

  // Add topic to graph
  const addTopic = async (title) => {
    if (!title.trim()) {
      setError('Please enter a topic');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const links = await fetchWikiLinks(title);
      
      setGraphData(prev => {
        const existingNode = prev.nodes.find(n => n.id === title);
        if (existingNode) {
          return prev;
        }

        const newNodes = [...prev.nodes, { id: title, title }];
        const newLinks = [...prev.links];

        links.forEach(link => {
          const linkNode = newNodes.find(n => n.id === link);
          if (!linkNode) {
            newNodes.push({ id: link, title: link });
          }
          
          if (!newLinks.find(l => l.source === title && l.target === link)) {
            newLinks.push({ source: title, target: link });
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

  // BFS pathfinding
  const findPath = async (start, end) => {
    if (!start.trim() || !end.trim()) {
      setError('Please enter both start and end topics');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const queue = [[start]];
      const visited = new Set([start]);
      const maxDepth = 4;
      
      while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        
        if (path.length > maxDepth) {
          setError(`No path found within ${maxDepth} steps`);
          break;
        }

        if (current.toLowerCase() === end.toLowerCase()) {
          // Visualize the path
          const pathNodes = [];
          const pathLinks = [];
          
          for (let i = 0; i < path.length; i++) {
            pathNodes.push({ id: path[i], title: path[i], inPath: true });
            if (i < path.length - 1) {
              pathLinks.push({ 
                source: path[i], 
                target: path[i + 1],
                inPath: true 
              });
            }
          }
          
          setGraphData({ nodes: pathNodes, links: pathLinks });
          setPathStart('');
          setPathEnd('');
          setLoading(false);
          return;
        }

        const links = await fetchWikiLinks(current);
        
        for (const link of links) {
          if (!visited.has(link)) {
            visited.add(link);
            queue.push([...path, link]);
          }
        }
      }
      
      if (!error) {
        setError('No path found between topics');
      }
    } catch (err) {
      console.error('Path finding error:', err);
      setError(err.message || 'Failed to find path');
    } finally {
      setLoading(false);
    }
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
      .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    const link = g.append('g')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', d => d.inPath ? '#00ff88' : '#444')
      .attr('stroke-width', d => d.inPath ? 3 : 1)
      .attr('stroke-opacity', 0.6);

    const node = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    node.append('circle')
      .attr('r', 8)
      .attr('fill', d => d.inPath ? '#00ff88' : '#0088ff')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node.append('text')
      .text(d => d.title)
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', '#e0e0e0')
      .attr('font-size', '11px')
      .attr('pointer-events', 'none');

    node
      .on('mouseenter', async (event, d) => {
        setHoveredNode(d);
        const sum = await fetchSummary(d.title);
        setSummary(sum);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
        setSummary('');
      })
      .on('click', (event, d) => {
        window.open(`https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}`, '_blank');
      })
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
  }, [graphData]);

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold mb-4 text-blue-400">WikiWeb Explorer</h1>
        
        {/* Search Bar */}
        <div className="flex gap-2 mb-3">
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

        {/* Find Path */}
        <div className="flex gap-2">
          <input
            type="text"
            value={pathStart}
            onChange={(e) => setPathStart(e.target.value)}
            placeholder="Start topic..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500 text-sm"
          />
          <input
            type="text"
            value={pathEnd}
            onChange={(e) => setPathEnd(e.target.value)}
            placeholder="End topic..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-green-500 text-sm"
          />
          <button
            onClick={() => findPath(pathStart, pathEnd)}
            disabled={loading || !pathStart || !pathEnd}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded transition text-sm"
          >
            Find Path
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
          <div className="mt-2 text-red-400 text-sm">{error}</div>
        )}
      </div>

      {/* Graph Visualization */}
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full"
        />
        
        {/* Tooltip */}
        {hoveredNode && (
          <div className="absolute top-4 left-4 max-w-sm bg-gray-800 border border-gray-700 rounded p-3 shadow-lg">
            <h3 className="font-bold text-blue-400 mb-2">{hoveredNode.title}</h3>
            <p className="text-sm text-gray-300">{summary || 'Loading summary...'}</p>
          </div>
        )}

        {/* Instructions */}
        {graphData.nodes.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500 max-w-md">
              <h2 className="text-xl font-semibold mb-4">Welcome to WikiWeb Explorer</h2>
              <p className="mb-2">🔍 Enter a Wikipedia topic to explore its connections</p>
              <p className="mb-2">🎯 Use "Find Path" to discover how topics connect</p>
              <p className="mb-2">🖱️ Drag nodes, hover for summaries, click to open articles</p>
              <p>🔎 Scroll to zoom, drag to pan</p>
            </div>
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