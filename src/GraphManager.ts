import * as d3 from 'd3';

export interface Node {
  id: string;
  title: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface Link {
  source: string | Node;
  target: string | Node;
}

export interface GraphCallbacks {
  onNodeClick?: (node: Node, event: MouseEvent) => void;
  onNodeDoubleClick?: (node: Node, event: MouseEvent) => void;
  onNodeDragStart?: (node: Node) => void;
  onNodeDragEnd?: (node: Node, isOverTrash: boolean) => void;
  onStatsUpdate?: (stats: { nodeCount: number; linkCount: number }) => void;
}

export interface NodeMetadata {
  isUserTyped: boolean;
  isAutoDiscovered: boolean;
  isExpanded: boolean;
  isInPath: boolean;
  isRecentlyAdded: boolean;
  isCurrentlyExploring: boolean;
  isSelected: boolean;
  thumbnail?: string;
}

/**
 * GraphManager - Imperative D3 graph management
 * Owns the simulation and DOM, provides methods for incremental updates
 */
export class GraphManager {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private linksGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private nodesGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private defs!: d3.Selection<SVGDefsElement, unknown, null, undefined>;

  private simulation!: d3.Simulation<Node, Link>;
  private nodes: Node[] = [];
  private links: Link[] = [];

  // Metadata maps for node styling
  private nodeMetadata: Map<string, NodeMetadata> = new Map();

  private callbacks: GraphCallbacks = {};
  private width: number;
  private height: number;
  private nodeSpacing: number = 150;

  // Drag state
  private dragThreshold = 5;
  private dragStartPos: { x: number; y: number } | null = null;

  constructor(svgElement: SVGSVGElement, callbacks: GraphCallbacks = {}) {
    this.svg = d3.select(svgElement);
    this.callbacks = callbacks;

    const rect = svgElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    console.log(`[GraphManager] SVG dimensions: ${this.width}x${this.height}`);

    if (this.width === 0 || this.height === 0) {
      console.error('[GraphManager] SVG has zero dimensions! Cannot render.');
      return;
    }

    this.initializeSVG();
    this.initializeSimulation();
  }

  private initializeSVG() {
    // Clear existing content
    this.svg.selectAll('*').remove();

    // Create main group for zoom/pan
    this.g = this.svg.append('g');

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Create groups for links and nodes
    this.linksGroup = this.g.append('g').attr('class', 'links');
    this.nodesGroup = this.g.append('g').attr('class', 'nodes');

    // Create defs for image patterns
    this.defs = this.svg.append('defs');
  }

  private initializeSimulation() {
    this.simulation = d3.forceSimulation<Node>(this.nodes)
      .force('link', d3.forceLink<Node, Link>(this.links)
        .id((d: any) => d.id)
        .distance(this.nodeSpacing))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => {
        const node = d as Node;
        // Dynamic collision based on connection count
        const connections = this.links.filter(l =>
          (typeof l.source === 'object' ? l.source.id : l.source) === node.id ||
          (typeof l.target === 'object' ? l.target.id : l.target) === node.id
        ).length;
        return Math.min(30 + connections * 0.5, 60) + 15;
      }))
      .on('tick', () => this.onTick());
  }

  /**
   * Add nodes to the graph (idempotent - won't add duplicates)
   */
  addNodes(newNodes: Node[]) {
    let added = 0;

    newNodes.forEach(node => {
      if (!this.nodes.find(n => n.id === node.id)) {
        // Give node initial random position if not set
        if (node.x === undefined) node.x = this.width / 2 + (Math.random() - 0.5) * 100;
        if (node.y === undefined) node.y = this.height / 2 + (Math.random() - 0.5) * 100;

        this.nodes.push(node);
        added++;

        // Initialize metadata if not exists
        if (!this.nodeMetadata.has(node.id)) {
          this.nodeMetadata.set(node.id, {
            isUserTyped: false,
            isAutoDiscovered: false,
            isExpanded: false,
            isInPath: false,
            isRecentlyAdded: false,
            isCurrentlyExploring: false,
            isSelected: false,
          });
        }
      }
    });

    if (added > 0) {
      this.simulation.nodes(this.nodes);
      this.simulation.alpha(0.3).restart();
      this.updateDOM();
      this.notifyStats();
    }
  }

  /**
   * Add links to the graph (validates both nodes exist)
   */
  addLinks(newLinks: Link[]) {
    let added = 0;

    newLinks.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      const sourceExists = this.nodes.find(n => n.id === sourceId);
      const targetExists = this.nodes.find(n => n.id === targetId);

      if (sourceExists && targetExists) {
        // Check if link already exists
        const exists = this.links.find(l => {
          const lSourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const lTargetId = typeof l.target === 'object' ? l.target.id : l.target;
          return lSourceId === sourceId && lTargetId === targetId;
        });

        if (!exists) {
          this.links.push(link);
          added++;
        }
      }
    });

    if (added > 0) {
      (this.simulation.force('link') as d3.ForceLink<Node, Link>).links(this.links);
      this.simulation.alpha(0.3).restart();
      this.updateDOM();
      this.notifyStats();
    }
  }

  /**
   * Delete a node and all its connections
   */
  deleteNode(nodeId: string) {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.links = this.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return sourceId !== nodeId && targetId !== nodeId;
    });

    this.nodeMetadata.delete(nodeId);

    this.simulation.nodes(this.nodes);
    (this.simulation.force('link') as d3.ForceLink<Node, Link>).links(this.links);
    this.updateDOM();
    this.notifyStats();
  }

  /**
   * Update node metadata for styling
   */
  setNodeMetadata(nodeId: string, metadata: Partial<NodeMetadata>) {
    const existing = this.nodeMetadata.get(nodeId) || {
      isUserTyped: false,
      isAutoDiscovered: false,
      isExpanded: false,
      isInPath: false,
      isRecentlyAdded: false,
      isCurrentlyExploring: false,
      isSelected: false,
    };

    this.nodeMetadata.set(nodeId, { ...existing, ...metadata });
    this.updateDOM(); // Re-render to apply new styles
  }

  /**
   * Set multiple nodes' metadata at once
   */
  setNodesMetadata(updates: Array<{ nodeId: string; metadata: Partial<NodeMetadata> }>) {
    updates.forEach(({ nodeId, metadata }) => {
      const existing = this.nodeMetadata.get(nodeId) || {
        isUserTyped: false,
        isAutoDiscovered: false,
        isExpanded: false,
        isInPath: false,
        isRecentlyAdded: false,
        isCurrentlyExploring: false,
        isSelected: false,
      };

      this.nodeMetadata.set(nodeId, { ...existing, ...metadata });
    });

    this.updateDOM();
  }

  /**
   * Update node spacing and restart simulation
   */
  setNodeSpacing(spacing: number) {
    this.nodeSpacing = spacing;
    (this.simulation.force('link') as d3.ForceLink<Node, Link>).distance(spacing);
    this.simulation.alpha(0.3).restart();
  }

  /**
   * Get current graph statistics
   */
  getStats() {
    return {
      nodeCount: this.nodes.length,
      linkCount: this.links.length,
    };
  }

  /**
   * Clear all nodes and links
   */
  clear() {
    this.nodes = [];
    this.links = [];
    this.nodeMetadata.clear();

    this.simulation.nodes(this.nodes);
    (this.simulation.force('link') as d3.ForceLink<Node, Link>).links(this.links);
    this.updateDOM();
    this.notifyStats();
  }

  /**
   * Update DOM - D3 join pattern
   */
  private updateDOM() {
    console.log(`[GraphManager] updateDOM called - ${this.nodes.length} nodes, ${this.links.length} links`);

    // Update image patterns in defs
    this.updateImagePatterns();

    // Update links
    this.updateLinks();

    // Update nodes
    this.updateNodes();

    // Force initial tick to position elements
    this.onTick();
  }

  private updateImagePatterns() {
    const nodesWithThumbnails = this.nodes.filter(n => {
      const meta = this.nodeMetadata.get(n.id);
      return meta?.thumbnail;
    });

    const patterns = this.defs
      .selectAll('pattern')
      .data(nodesWithThumbnails, (d: any) => `img-${this.sanitizeId(d.id)}`);

    patterns.enter()
      .append('pattern')
      .attr('id', d => `img-${this.sanitizeId(d.id)}`)
      .attr('width', 1)
      .attr('height', 1)
      .attr('patternContentUnits', 'objectBoundingBox')
      .append('image')
      .attr('href', d => this.nodeMetadata.get(d.id)?.thumbnail || '')
      .attr('width', 1)
      .attr('height', 1)
      .attr('preserveAspectRatio', 'xMidYMid slice');

    patterns.exit().remove();
  }

  private updateLinks() {
    const linkElements = this.linksGroup
      .selectAll('line')
      .data(this.links, (d: any) => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        return `${sourceId}-${targetId}`;
      });

    linkElements.enter()
      .append('line')
      .attr('stroke', '#444')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .merge(linkElements as any)
      .attr('stroke', d => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        const sourceMeta = this.nodeMetadata.get(sourceId);
        const targetMeta = this.nodeMetadata.get(targetId);

        if (sourceMeta?.isInPath && targetMeta?.isInPath) {
          return '#00ff88'; // Green for path
        }
        return '#666'; // Lighter grey for better visibility
      })
      .attr('stroke-width', d => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        const sourceMeta = this.nodeMetadata.get(sourceId);
        const targetMeta = this.nodeMetadata.get(targetId);

        if (sourceMeta?.isInPath && targetMeta?.isInPath) {
          return 4; // Thick for path
        }
        return 2; // Thicker default
      });

    linkElements.exit().remove();
  }

  private updateNodes() {
    const nodeGroups = this.nodesGroup
      .selectAll('g')
      .data(this.nodes, (d: any) => d.id);

    console.log(`[GraphManager] updateNodes - enter: ${nodeGroups.enter().size()}, update: ${nodeGroups.size()}, exit: ${nodeGroups.exit().size()}`);

    // Enter
    const enter = nodeGroups.enter()
      .append('g')
      .call(this.setupDrag() as any)
      .style('cursor', 'pointer');

    // Merge enter + update
    const merged = enter.merge(nodeGroups as any);

    // Clear and rebuild node contents
    merged.selectAll('*').remove();

    merged.each((d, i, nodes) => {
      const group = d3.select(nodes[i]);
      const meta: Partial<NodeMetadata> = this.nodeMetadata.get(d.id) || {};

      // Calculate radius based on connections
      const connections = this.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return sourceId === d.id || targetId === d.id;
      }).length;
      const radius = Math.min(30 + connections * 0.5, 60);

      // Background image circle if thumbnail exists
      if (meta.thumbnail) {
        group.append('circle')
          .attr('r', radius)
          .attr('fill', `url(#img-${this.sanitizeId(d.id)})`)
          .attr('fill-opacity', 0.4);
      }

      // Overlay colored circle
      const color = this.getNodeColor(d.id, meta);
      group.append('circle')
        .attr('r', radius)
        .attr('fill', color)
        .attr('fill-opacity', meta.thumbnail ? 0.3 : 1)
        .attr('stroke', this.getNodeStroke(meta))
        .attr('stroke-width', this.getNodeStrokeWidth(meta));

      // Text label
      this.addTextLabel(group, d.title);
    });

    // Setup click handlers
    merged
      .on('click', (event: MouseEvent, d) => {
        if (!event.defaultPrevented && this.callbacks.onNodeClick) {
          this.callbacks.onNodeClick(d, event);
        }
      })
      .on('dblclick', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (this.callbacks.onNodeDoubleClick) {
          this.callbacks.onNodeDoubleClick(d, event);
        }
      });

    // Exit
    nodeGroups.exit().remove();
  }

  private getNodeColor(_nodeId: string, meta: Partial<NodeMetadata>): string {
    if (meta.isInPath) return '#00ff88'; // Green for path
    if (meta.isCurrentlyExploring) return '#ffdd00'; // Yellow for currently exploring
    if (meta.isSelected) return '#ff8800'; // Orange for selected
    if (meta.isRecentlyAdded) return '#ff00ff'; // Magenta for newly added
    if (meta.isUserTyped) return '#0088ff'; // Blue for user-typed
    if (meta.isAutoDiscovered) return '#9966ff'; // Purple for auto-discovered
    return '#0088ff'; // Default blue
  }

  private getNodeStroke(meta: Partial<NodeMetadata>): string {
    if (meta.isSelected) return '#ffff00'; // Yellow stroke for selected
    if (meta.isCurrentlyExploring) return '#ff6600'; // Orange stroke for exploring
    if (meta.isExpanded) return '#00ffff'; // Cyan for expanded
    return '#fff';
  }

  private getNodeStrokeWidth(meta: Partial<NodeMetadata>): number {
    if (meta.isCurrentlyExploring) return 4;
    if (meta.isSelected) return 3;
    if (meta.isExpanded) return 3;
    return 2;
  }

  private addTextLabel(group: d3.Selection<SVGGElement, any, any, any>, title: string) {
    const textElement = group.append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none');

    // Simple text wrapping
    const words = title.split(/\s+/);
    const maxCharsPerLine = 10;
    const maxLines = 3;
    let lines: string[] = [];
    let currentLine = '';

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

    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].substring(0, maxCharsPerLine - 2) + '...';
    }

    const lineHeight = 10;
    const totalHeight = lines.length * lineHeight;
    const startY = -(totalHeight / 2) + (lineHeight / 2);

    lines.forEach((line, i) => {
      textElement.append('tspan')
        .attr('x', 0)
        .attr('y', startY + (i * lineHeight))
        .text(line);
    });
  }

  private setupDrag() {
    return d3.drag<SVGGElement, Node>()
      .on('start', (event, d) => {
        this.dragStartPos = { x: event.x, y: event.y };

        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;

        if (this.callbacks.onNodeDragStart) {
          this.callbacks.onNodeDragStart(d);
        }
      })
      .on('drag', (event, d) => {
        if (!this.dragStartPos) return;

        const dx = event.x - this.dragStartPos.x;
        const dy = event.y - this.dragStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.dragThreshold) {
          event.sourceEvent.preventDefault();
          d.fx = event.x;
          d.fy = event.y;
        }
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);

        const dx = event.x - (this.dragStartPos?.x || 0);
        const dy = event.y - (this.dragStartPos?.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.dragThreshold) {
          // Was a real drag - check if over trash
          const mouseX = event.sourceEvent.clientX;
          const mouseY = event.sourceEvent.clientY;
          const windowHeight = window.innerHeight;
          const isOverTrash = mouseX < 150 && mouseY > windowHeight - 150;

          if (this.callbacks.onNodeDragEnd) {
            this.callbacks.onNodeDragEnd(d, isOverTrash);
          }
        }

        d.fx = null;
        d.fy = null;
        this.dragStartPos = null;
      });
  }

  private onTick() {
    // Update link positions
    this.linksGroup.selectAll('line')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    // Update node positions
    this.nodesGroup.selectAll('g')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  }

  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  private notifyStats() {
    if (this.callbacks.onStatsUpdate) {
      this.callbacks.onStatsUpdate({
        nodeCount: this.nodes.length,
        linkCount: this.links.length,
      });
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.simulation.stop();
    this.svg.selectAll('*').remove();
  }
}
