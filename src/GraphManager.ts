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
  metadata?: Partial<NodeMetadata>;
}

export interface Link {
  source: string | Node;
  target: string | Node;
  id: string; // Made required for easier tracking
  type?: string; // 'manual', 'auto', 'expand', 'path'
  context?: string; // Text context from Wikipedia
}

export type GraphStateSnapshot = {
  nodes: Node[];
  links: Array<Omit<Link, 'source' | 'target'> & { source: string; target: string }>;
  nodeMetadata: Record<string, NodeMetadata>;
};

export interface GraphCallbacks {
  onNodeClick?: (node: Node, event: MouseEvent) => void;
  onNodeDoubleClick?: (node: Node, event: MouseEvent) => void;
  onNodeDragStart?: (node: Node) => void;
  onLinkClick?: (link: Link, event: MouseEvent) => void;
  onBackgroundClick?: (event: MouseEvent) => void;
  onLinkHover?: (link: Link, event: MouseEvent) => void;
  onLinkHoverEnd?: (link: Link, event: MouseEvent) => void;
  onLinksApplied?: (args: { added: Link[]; updated: Link[] }) => void;
  onStatsUpdate?: (stats: { nodeCount: number; linkCount: number }) => void;
  onSelectionChange?: (selectedNodes: Node[]) => void;
}

export interface NodeMetadata {
  isUserTyped: boolean;
  isAutoDiscovered: boolean;
  isExpanded: boolean;
  isInPath: boolean;
  isRecentlyAdded: boolean;
  isCurrentlyExploring: boolean;
  isSelected: boolean;
  isPathEndpoint: boolean;
  isBulkSelected: boolean;
  isDimmed: boolean;
  isDimmedByPath: boolean;
  isFocusTarget?: boolean;
  isFocusNeighbor?: boolean;
  thumbnail?: string;
  originSeed?: string;
  originDepth?: number;
  colorSeed?: string;
  colorRole?: 'root' | 'child';
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
  private brushGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private currentZoomTransform: d3.ZoomTransform = d3.zoomIdentity;

  private simulation!: d3.Simulation<Node, Link>;
  private nodes: Node[] = [];
  private links: Link[] = [];

  // Metadata maps for node styling
  private nodeMetadata: Map<string, NodeMetadata> = new Map();
  private focusNodeId: string | null = null;
  private focusNeighborIds: Set<string> = new Set();

  private callbacks: GraphCallbacks = {};
  private width: number;
  private height: number;
  private nodeSpacing: number = 150;
  private nodeSizeScale: number = 1;

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
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => !event.altKey) // Disable zoom on Alt/Option (for box selection)
      .on('zoom', (event) => {
        this.currentZoomTransform = event.transform;
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoomBehavior)
      .on('dblclick.zoom', null); // Disable double click zoom

    // Selection Brush Logic
    this.brushGroup = this.svg.append('g').attr('class', 'brush-layer');

    const selectionDrag = d3.drag<SVGSVGElement, unknown>()
      .filter(event => event.altKey) // Only enable on Alt/Option
      .on('start', (event) => this.dragSelectionStart(event))
      .on('drag', (event) => this.dragSelectionMove(event))
      .on('end', (event) => this.dragSelectionEnd(event));

    this.svg.call(selectionDrag);
    // Create groups for links and nodes
    this.linksGroup = this.g.append('g').attr('class', 'links');
    this.nodesGroup = this.g.append('g').attr('class', 'nodes');

    // Create defs for image patterns
    this.defs = this.svg.append('defs');

    this.initializeFilters();

    this.svg.on('click.background', (event: any) => {
      // Only treat clicks on empty canvas as background clicks (not nodes/links/groups).
      const target = event?.target as Element | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'svg') {
        this.callbacks.onBackgroundClick?.(event as MouseEvent);
      }
    });
  }

  private initializeFilters() {
    this.defs.selectAll('filter.focus-glow').remove();

    const focus = this.defs.append('filter')
      .attr('class', 'focus-glow')
      .attr('id', 'focus-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    focus.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', 3)
      .attr('result', 'blur');

    focus.append('feColorMatrix')
      .attr('in', 'blur')
      .attr('type', 'matrix')
      .attr('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0')
      .attr('result', 'glow');

    const merge = focus.append('feMerge');
    merge.append('feMergeNode').attr('in', 'glow');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const neighbor = this.defs.append('filter')
      .attr('class', 'focus-glow')
      .attr('id', 'neighbor-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    neighbor.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', 2)
      .attr('result', 'blur');

    const nMerge = neighbor.append('feMerge');
    nMerge.append('feMergeNode').attr('in', 'blur');
    nMerge.append('feMergeNode').attr('in', 'SourceGraphic');
  }

  private initializeSimulation() {
    this.simulation = d3.forceSimulation<Node>(this.nodes)
      .force('link', d3.forceLink<Node, Link>(this.links)
        .id((d: any) => d.id)
        .distance(this.nodeSpacing))
      .force('charge', d3.forceManyBody().strength(-500)) // Stronger repulsion
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => {
        const node = d as Node;
        // Dynamic collision based on connection count
        const connections = this.links.filter(l =>
          (typeof l.source === 'object' ? l.source.id : l.source) === node.id ||
          (typeof l.target === 'object' ? l.target.id : l.target) === node.id
        ).length;
        return (Math.min(30 + connections * 0.5, 60) * this.nodeSizeScale) + 15;
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
        const incomingMetadata = node.metadata;
        const cleanNode: Node = { ...node };
        delete (cleanNode as any).metadata;

        // Give node initial random position if not set
        if (cleanNode.x === undefined) cleanNode.x = this.width / 2 + (Math.random() - 0.5) * 300;
        if (cleanNode.y === undefined) cleanNode.y = this.height / 2 + (Math.random() - 0.5) * 300;

        this.nodes.push(cleanNode);
        added++;

        // Initialize metadata if not exists
        if (!this.nodeMetadata.has(cleanNode.id)) {
          this.nodeMetadata.set(cleanNode.id, {
            isUserTyped: false,
            isAutoDiscovered: false,
            isExpanded: false,
            isInPath: false,
            isRecentlyAdded: false,
            isCurrentlyExploring: false,
            isSelected: false,
            isPathEndpoint: false,
            isBulkSelected: false,
            originSeed: undefined,
            originDepth: undefined,
            colorSeed: undefined,
            colorRole: undefined,
            isDimmed: false, // Focus dimming
            isDimmedByPath: false, // Path dimming
            isFocusTarget: false,
            isFocusNeighbor: false
          });
        }

        if (incomingMetadata) {
          const existing = this.nodeMetadata.get(cleanNode.id)!;
          this.nodeMetadata.set(cleanNode.id, { ...existing, ...incomingMetadata });
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
    const addedLinks: Link[] = [];
    const updatedLinks: Link[] = [];

    newLinks.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      const sourceExists = this.nodes.find(n => n.id === sourceId);
      const targetExists = this.nodes.find(n => n.id === targetId);

      if (sourceExists && targetExists) {
        // Check if link already exists
        const existingLink = this.links.find(l => {
          const lSourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const lTargetId = typeof l.target === 'object' ? l.target.id : l.target;
          return lSourceId === sourceId && lTargetId === targetId;
        });

        if (!existingLink) {
          // Ensure ID exists
          if (!link.id) link.id = `${sourceId}-${targetId}`;
          this.links.push(link);
          added++;
          addedLinks.push(link);
        } else {
          // Update metadata/upgrade link
          if (link.type === 'path' && existingLink.type !== 'path') {
            existingLink.type = 'path';
            updatedLinks.push(existingLink);
          }
          if (link.context && !existingLink.context) {
            existingLink.context = link.context; // Enrich
            if (!updatedLinks.includes(existingLink)) updatedLinks.push(existingLink);
          }
        }
      }
    });

    if (added > 0) {
      (this.simulation.force('link') as d3.ForceLink<any, Link>).links(this.links);
      this.simulation.alpha(0.3).restart();
      this.updateDOM();
      this.notifyStats();
    }

    if (updatedLinks.length > 0 && added === 0) {
      this.updateDOM();
    }

    if ((addedLinks.length > 0 || updatedLinks.length > 0) && this.callbacks.onLinksApplied) {
      this.callbacks.onLinksApplied({ added: addedLinks, updated: updatedLinks });
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
    (this.simulation.force('link') as d3.ForceLink<any, Link>).links(this.links);
    this.updateDOM();
    this.notifyStats();
  }

  /**
   * Prune nodes with fewer than 2 connections (leaf nodes)
   * Returns number of deleted nodes
   */
  pruneNodes(): number {
    const nodesToDelete = new Set<string>();

    this.nodes.forEach(node => {
      const connections = this.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return sourceId === node.id || targetId === node.id;
      }).length;

      if (connections < 2) {
        nodesToDelete.add(node.id);
      }
    });

    if (nodesToDelete.size > 0) {
      this.nodes = this.nodes.filter(n => !nodesToDelete.has(n.id));
      this.links = this.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return !nodesToDelete.has(sourceId) && !nodesToDelete.has(targetId);
      });

      nodesToDelete.forEach(id => this.nodeMetadata.delete(id));

      this.simulation.nodes(this.nodes);
      (this.simulation.force('link') as d3.ForceLink<any, Link>).links(this.links);

      // Force aggressive reorganization
      this.simulation.alpha(1).restart();

      this.updateDOM();
      this.notifyStats();
    }

    return nodesToDelete.size;
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
      isPathEndpoint: false,
      isBulkSelected: false,
      originSeed: undefined,
      originDepth: undefined,
      colorSeed: undefined,
      colorRole: undefined,
      isDimmed: false,
      isDimmedByPath: false,
      isFocusTarget: false,
      isFocusNeighbor: false
    };

    const newMeta = { ...existing, ...metadata };
    this.nodeMetadata.set(nodeId, newMeta);

    // Re-render specifically this node (optimization could be better but this is safe)
    this.updateNodes();
    this.updateLinks(); // Update styles
  }


  // --- Selection Brush Handling ---
  private selectionStartPoint: { x: number, y: number } | null = null;

  private dragSelectionStart(event: any) {
    const { x, y } = event; // Screen coords relative to SVG
    this.selectionStartPoint = { x, y };

    this.brushGroup.selectAll('rect').remove();
    this.brushGroup.append('rect')
      .attr('x', x)
      .attr('y', y)
      .attr('width', 0)
      .attr('height', 0)
      .attr('fill', 'rgba(255, 136, 0, 0.12)')
      .attr('stroke', 'rgba(255, 136, 0, 0.65)')
      .attr('stroke-dasharray', '4');
  }

  private dragSelectionMove(event: any) {
    if (!this.selectionStartPoint) return;
    const { x, y } = event;
    const start = this.selectionStartPoint;

    const minX = Math.min(start.x, x);
    const minY = Math.min(start.y, y);
    const width = Math.abs(x - start.x);
    const height = Math.abs(y - start.y);

    this.brushGroup.select('rect')
      .attr('x', minX)
      .attr('y', minY)
      .attr('width', width)
      .attr('height', height);
  }

  private dragSelectionEnd(event: any) {
    if (!this.selectionStartPoint) return;

    const end = { x: event.x, y: event.y };
    const start = this.selectionStartPoint;

    // Calculate selection box in Screen Space
    const x0 = Math.min(start.x, end.x);
    const x1 = Math.max(start.x, end.x);
    const y0 = Math.min(start.y, end.y);
    const y1 = Math.max(start.y, end.y);

    // Clear brush visual
    this.brushGroup.selectAll('rect').remove();
    this.selectionStartPoint = null;

    // Determine nodes within box
    // Need to transform node coordinates (World Space) to Screen Space
    // OR transform Box to World Space.
    // Let's transform Nodes to Screen Space.

    const transform = d3.zoomTransform(this.svg.node()!);

    const selectedNodes: Node[] = [];

    this.nodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) return;
      const screenX = transform.applyX(node.x);
      const screenY = transform.applyY(node.y);

      if (screenX >= x0 && screenX <= x1 && screenY >= y0 && screenY <= y1) {
        selectedNodes.push(node);
      }
    });

    if (this.callbacks.onSelectionChange) {
      this.callbacks.onSelectionChange(selectedNodes);
    }
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
        isPathEndpoint: false,
        isBulkSelected: false,
        originSeed: undefined,
        originDepth: undefined,
        colorSeed: undefined,
        colorRole: undefined,
        isDimmed: false,
        isDimmedByPath: false,
        isFocusTarget: false,
        isFocusNeighbor: false
      };

      this.nodeMetadata.set(nodeId, { ...existing, ...metadata });
    });

    this.updateDOM();
  }

  /**
   * Highlight a node and its direct connections
   */
  highlightNode(targetNodeId: string | null) {
    this.focusNodeId = targetNodeId;
    this.focusNeighborIds = new Set();

    if (targetNodeId === null) {
      // Reset all dimming
      this.nodeMetadata.forEach(meta => {
        meta.isDimmed = false;
        meta.isFocusTarget = false;
        meta.isFocusNeighbor = false;
      });
    } else {
      // Find neighbors
      const neighbors = new Set<string>();
      this.links.forEach(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        if (sourceId === targetNodeId) neighbors.add(targetId);
        if (targetId === targetNodeId) neighbors.add(sourceId);
      });
      this.focusNeighborIds = neighbors;

      // Apply dimming
      this.nodes.forEach(n => {
        const meta = this.nodeMetadata.get(n.id);
        if (meta) {
          meta.isDimmed = n.id !== targetNodeId && !neighbors.has(n.id);
          meta.isFocusTarget = n.id === targetNodeId;
          meta.isFocusNeighbor = neighbors.has(n.id);
        }
      });
    }

    this.updateDOM();
  }

  /**
   * Dim non-path nodes while a path is active.
   */
  setPathHighlight(pathNodeIds: Set<string> | null) {
    const active = pathNodeIds && pathNodeIds.size > 0;
    this.nodes.forEach(n => {
      const meta = this.nodeMetadata.get(n.id);
      if (!meta) return;
      meta.isDimmedByPath = active ? !pathNodeIds!.has(n.id) : false;
    });
    this.updateDOM();
  }

  /**
   * Update node spacing and restart simulation
   */
  setNodeSpacing(spacing: number) {
    this.nodeSpacing = spacing;
    (this.simulation.force('link') as d3.ForceLink<any, Link>).distance(spacing);
    this.simulation.alpha(0.3).restart();
  }

  setNodeSizeScale(scale: number) {
    const next = Number.isFinite(scale) ? Math.min(2, Math.max(0.4, scale)) : 1;
    this.nodeSizeScale = next;
    this.updateDOM();
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
    this.focusNodeId = null;
    this.focusNeighborIds = new Set();

    this.simulation.nodes(this.nodes);
    (this.simulation.force('link') as d3.ForceLink<any, Link>).links(this.links);
    this.updateDOM();
    this.notifyStats();
  }

  resize(width: number, height: number) {
    const nextW = Math.max(1, Math.floor(width));
    const nextH = Math.max(1, Math.floor(height));
    if (nextW === this.width && nextH === this.height) return;
    this.width = nextW;
    this.height = nextH;
    (this.simulation.force('center') as d3.ForceCenter<Node>).x(this.width / 2).y(this.height / 2);
    this.simulation.alpha(0.2).restart();
  }

  hasNode(nodeId: string) {
    return this.nodes.some(n => n.id === nodeId);
  }

  getNodeIds() {
    return this.nodes.map(n => n.id);
  }

  getNodeDegree(nodeId: string) {
    return this.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return sourceId === nodeId || targetId === nodeId;
    }).length;
  }

  getStateSnapshot(): GraphStateSnapshot {
    const nodes = this.nodes.map(n => ({ ...n }));
    const links = this.links.map(l => {
      const source = typeof l.source === 'object' ? l.source.id : l.source;
      const target = typeof l.target === 'object' ? l.target.id : l.target;
      return {
        ...l,
        source,
        target,
      };
    });
    const nodeMetadata: Record<string, NodeMetadata> = {};
    this.nodeMetadata.forEach((meta, id) => {
      nodeMetadata[id] = { ...meta };
    });
    return { nodes, links, nodeMetadata };
  }

  setStateSnapshot(snapshot: GraphStateSnapshot) {
    this.clear();
    this.nodeMetadata = new Map(Object.entries(snapshot.nodeMetadata || {}).map(([k, v]) => [k, { ...v }]));
    this.addNodes(snapshot.nodes.map(n => ({ ...n })));
    this.addLinks(
      snapshot.links.map(l => ({
        ...l,
        source: l.source,
        target: l.target,
      }))
    );
    this.updateDOM();
    this.notifyStats();
    this.simulation.alpha(0.3).restart();
  }

  /**
   * Update DOM - D3 join pattern
   */
  private updateDOM() {
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
    // Touch long-press (mobile) to mimic hover feedback on links
    const longPressTimers = new WeakMap<SVGLineElement, number>();
    const longPressStarts = new WeakMap<SVGLineElement, { x: number; y: number }>();
    const longPressTriggered = new WeakMap<SVGLineElement, boolean>();

    const highlightLink = (el: d3.Selection<SVGLineElement, any, any, any>, d: Link) => {
      const style = this.getLinkStyle(d);
      const strokeValue = style.useGradient && style.gradientId
        ? `url(#${style.gradientId})`
        : '#00ffff';
      el.attr('stroke', strokeValue)
        .attr('stroke-width', Math.max(style.strokeWidth + 2, 6))
        .attr('stroke-opacity', 1);
    };

    const resetLink = (el: d3.Selection<SVGLineElement, any, any, any>, d: Link) => {
      this.applyLinkStyles(el as any, d);
    };

    const clearLongPress = (el: SVGLineElement, d: Link, shouldReset = true) => {
      const timer = longPressTimers.get(el);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        longPressTimers.delete(el);
      }
      const wasTriggered = longPressTriggered.get(el);
      if (shouldReset && wasTriggered) {
        const group = d3.select(el.parentNode as SVGGElement);
        resetLink(group.select('line.visible') as any, d);
      }
      longPressTriggered.delete(el);
      longPressStarts.delete(el);
    };

    const linkGroups = this.linksGroup
      .selectAll<SVGGElement, Link>('g.link')
      .data(this.links, (d: any) => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        return `${sourceId}-${targetId}`;
      });

    const enter = linkGroups.enter()
      .append('g')
      .attr('class', 'link');

    // Invisible hit area (bigger click target)
    enter.append('line')
      .attr('class', 'hit')
      .attr('stroke', '#000')
      .attr('stroke-opacity', 0)
      .attr('stroke-linecap', 'round')
      .style('pointer-events', 'stroke')
      .style('cursor', 'pointer');

    // Visible stroke
    enter.append('line')
      .attr('class', 'visible')
      .attr('stroke', '#444')
      .attr('stroke-width', 0)
      .attr('stroke-opacity', 0)
      .style('pointer-events', 'none');

    const merged = enter.merge(linkGroups as any);

    const hit = merged.select<SVGLineElement>('line.hit');

    // Initial style application (visible + hit sizing)
    merged.each((d, i, nodes) => {
      const group = d3.select(nodes[i]);
      const v = group.select<SVGLineElement>('line.visible');
      this.applyLinkStyles(v as any, d);
      const style = this.getLinkStyle(d);
      group.select<SVGLineElement>('line.hit')
        .attr('stroke-width', Math.max(14, style.strokeWidth + 10));
    });

    /* removed individual attr chains in favor of centralized applyLinkStyles for reusability in mouseout */


    // Link events (attach to hit area for easier interaction)
    hit
      .on('click', (event, d) => {
        event.stopPropagation();
        if (this.callbacks.onLinkClick) {
          this.callbacks.onLinkClick(d, event);
        }
      })
      .on('mouseover', (event, d) => {
        const group = d3.select((event.currentTarget as SVGLineElement).parentNode as SVGGElement);
        highlightLink(group.select('line.visible') as any, d);
        this.callbacks.onLinkHover?.(d, event);
      })
      .on('mouseout', (event, d) => {
        // Re-apply original styles based on metadata
        const group = d3.select((event.currentTarget as SVGLineElement).parentNode as SVGGElement);
        resetLink(group.select('line.visible') as any, d);
        this.callbacks.onLinkHoverEnd?.(d, event);
      })
      .on('pointerdown', (event, d) => {
        if (event.pointerType !== 'touch') return;
        const el = event.currentTarget as SVGLineElement;
        longPressStarts.set(el, { x: event.clientX, y: event.clientY });
        longPressTriggered.set(el, false);
        const timer = window.setTimeout(() => {
          longPressTriggered.set(el, true);
          const group = d3.select(el.parentNode as SVGGElement);
          highlightLink(group.select('line.visible') as any, d);
        }, 280);
        longPressTimers.set(el, timer);
      })
      .on('pointermove', (event, d) => {
        if (event.pointerType !== 'touch') return;
        const el = event.currentTarget as SVGLineElement;
        const start = longPressStarts.get(el);
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
          clearLongPress(el, d);
        }
      })
      .on('pointerup', (event, d) => {
        if (event.pointerType !== 'touch') return;
        const el = event.currentTarget as SVGLineElement;
        clearLongPress(el, d);
      })
      .on('pointercancel', (event, d) => {
        if (event.pointerType !== 'touch') return;
        const el = event.currentTarget as SVGLineElement;
        clearLongPress(el, d);
      })
      .on('pointerleave', (event, d) => {
        if (event.pointerType !== 'touch') return;
        const el = event.currentTarget as SVGLineElement;
        clearLongPress(el, d);
      });

    // Animate in newly created links
    enter.select<SVGLineElement>('line.visible')
      .transition()
      .duration(320)
      .attr('stroke-width', (d: Link) => this.getLinkStyle(d).strokeWidth)
      .attr('stroke-opacity', (d: Link) => this.getLinkStyle(d).strokeOpacity)
      .attr('stroke-dashoffset', null);

    linkGroups
      .exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();
  }

  private getLinkStyle(d: Link) {
    const sourceId = typeof d.source === 'object' ? d.source.id : d.source as string;
    const targetId = typeof d.target === 'object' ? d.target.id : d.target as string;
    const sourceMeta = this.nodeMetadata.get(sourceId);
    const targetMeta = this.nodeMetadata.get(targetId);
    const isPathLink = Boolean(sourceMeta?.isInPath && targetMeta?.isInPath);
    const gradientId = isPathLink ? this.getGradientId(sourceId, targetId) : undefined;
    const isBacklink = typeof d.type === 'string' && d.type.includes('backlink');

    const focusActive = this.focusNodeId !== null;
    const isIncidentToFocus = focusActive && (sourceId === this.focusNodeId || targetId === this.focusNodeId);
    const isBetweenNeighbors = focusActive && this.focusNeighborIds.has(sourceId) && this.focusNeighborIds.has(targetId);

    const isDimmed =
      Boolean(sourceMeta?.isDimmed || sourceMeta?.isDimmedByPath) ||
      Boolean(targetMeta?.isDimmed || targetMeta?.isDimmedByPath);

    const originSeed = sourceMeta?.originSeed || targetMeta?.originSeed;
    const originDepth = sourceMeta?.originDepth ?? targetMeta?.originDepth ?? 0;

    const baseStroke = (() => {
      if (isDimmed) return '#555';
      if (isPathLink) return '#00ff88';
      if (isBacklink) return '#ffb020';
      if (originSeed) return this.hashColor(originSeed, 0.72, 0.62, Math.max(0, Math.min(12, originDepth)) * 10);
      return '#888';
    })();

    const baseStrokeWidth = (() => {
      if (isDimmed) return 1;
      if (isPathLink) return 4;
      return isBacklink ? 2 : 3;
    })();

    const baseStrokeOpacity = (() => {
      if (isDimmed) return 0.12;
      if (isPathLink) return 0.85;
      return isBacklink ? 0.5 : 0.6;
    })();

    const stroke = (() => {
      if (isIncidentToFocus) return baseStroke;
      return baseStroke;
    })();

    const strokeWidth = (() => {
      if (isIncidentToFocus) return 5;
      if (focusActive && isBetweenNeighbors) return Math.max(2, baseStrokeWidth - 0.5);
      if (focusActive) return Math.max(1.5, baseStrokeWidth - 1);
      return baseStrokeWidth;
    })();

    const strokeOpacity = (() => {
      if (isIncidentToFocus) return 0.98;
      if (focusActive && isBetweenNeighbors) return Math.max(0.30, baseStrokeOpacity * 0.55);
      if (focusActive) return Math.max(0.30, baseStrokeOpacity * 0.55);
      return baseStrokeOpacity;
    })();

    return {
      stroke,
      strokeWidth,
      strokeOpacity,
      useGradient: isPathLink,
      gradientId,
      dasharray: isBacklink ? '6 10' : undefined,
    };
  }

  private applyLinkStyles(
    selection: d3.Selection<any, Link, any, any>,
    d: Link,
    _options: { preserveDashAnimation?: boolean } = {}
  ) {
    const style = this.getLinkStyle(d);
    const strokeValue = style.gradientId ? `url(#${style.gradientId})` : style.stroke;
    selection
      .attr('stroke', strokeValue)
      .attr('stroke-width', style.strokeWidth)
      .attr('stroke-opacity', style.strokeOpacity);

    selection.attr('stroke-dasharray', style.dasharray ?? null);
  }

  private isPathLink(d: Link) {
    const sourceId = typeof d.source === 'object' ? d.source.id : d.source as string;
    const targetId = typeof d.target === 'object' ? d.target.id : d.target as string;
    const sourceMeta = this.nodeMetadata.get(sourceId);
    const targetMeta = this.nodeMetadata.get(targetId);
    return Boolean(sourceMeta?.isInPath && targetMeta?.isInPath);
  }

  private getGradientId(sourceId: string, targetId: string) {
    return `link-grad-${this.sanitizeId(sourceId)}-${this.sanitizeId(targetId)}`;
  }

  private updateLinkGradients() {
    const gradientLinks = this.links.filter(l => this.isPathLink(l));

    const gradients = this.defs.selectAll<SVGLinearGradientElement, Link>('linearGradient.link-gradient')
      .data(gradientLinks, (d: any) => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source as string;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target as string;
        return this.getGradientId(sourceId, targetId);
      });

    const enter = gradients.enter()
      .append('linearGradient')
      .attr('class', 'link-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');

    enter.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#22d3ee')
      .attr('stop-opacity', 0.9);

    enter.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#a855f7')
      .attr('stop-opacity', 0.9);

    const merged = enter.merge(gradients as any);

    merged
      .attr('id', (d: any) => {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source as string;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target as string;
        return this.getGradientId(sourceId, targetId);
      })
      .attr('x1', (d: any) => (typeof d.source === 'object' ? d.source.x : 0) ?? 0)
      .attr('y1', (d: any) => (typeof d.source === 'object' ? d.source.y : 0) ?? 0)
      .attr('x2', (d: any) => (typeof d.target === 'object' ? d.target.x : 0) ?? 0)
      .attr('y2', (d: any) => (typeof d.target === 'object' ? d.target.y : 0) ?? 0);

    gradients.exit().remove();
  }

  /**
   * Get the current screen coordinates of a link's midpoint
   */
  getLinkScreenCoordinates(linkId: string): { x: number, y: number } | null {
    const link = this.links.find(l => l.id === linkId);
    if (!link) return null;

    const source = link.source as Node;
    const target = link.target as Node;

    if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return null;

    // Calculate midpoint in SVG coordinates
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;

    // Apply zoom transform to get screen coordinates
    const transform = d3.zoomTransform(this.svg.node()!);
    const screenX = transform.applyX(midX);
    const screenY = transform.applyY(midY);

    return { x: screenX, y: screenY };
  }

  private updateNodes() {
    const nodeGroups = this.nodesGroup
      .selectAll('g')
      .data(this.nodes, (d: any) => d.id);

    // Enter
    const enter = nodeGroups.enter()
      .append('g')
      .call(this.setupDrag() as any)
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Merge enter + update
    const merged = enter.merge(nodeGroups as any);

    // Clear and rebuild node contents (keep outer group for translate)
    merged.selectAll('*').remove();

    merged.each((d, i, nodes) => {
      const group = d3.select(nodes[i]);
      const inner = group.append('g').attr('class', 'node-inner');
      const meta: Partial<NodeMetadata> = this.nodeMetadata.get(d.id) || {};

      // Update opacity based on dimming (focus vs path)
      const isFocusTarget = Boolean(meta.isFocusTarget);
      const isFocusNeighbor = Boolean(meta.isFocusNeighbor);
      const isDimmedByPath = Boolean(meta.isDimmedByPath);
      const isDimmedByFocus = Boolean(meta.isDimmed);
      const opacity = (() => {
        if (isFocusTarget) return 1;
        if (isFocusNeighbor) return 0.92;
        if (isDimmedByPath && isDimmedByFocus) return 0.70;
        if (isDimmedByPath) return 0.78;
        if (isDimmedByFocus) return 0.86;
        return 1;
      })();
      group.attr('opacity', opacity);

      // Calculate radius based on connections
      const connections = this.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return sourceId === d.id || targetId === d.id;
      }).length;
      const radius = Math.min(30 + connections * 0.5, 60) * this.nodeSizeScale;

      const focusScale = this.getFocusScale(meta);
      inner.attr('transform', `scale(${focusScale})`);

      // Background image circle if thumbnail exists
      if (meta.thumbnail) {
        inner.append('circle')
          .attr('r', radius)
          .attr('fill', `url(#img-${this.sanitizeId(d.id)})`)
          .attr('fill-opacity', 0.4);
      }

      // Overlay colored circle
      const color = this.getNodeColor(d.id, meta);
      inner.append('circle')
        .attr('r', radius)
        .attr('fill', color)
        .attr('fill-opacity', meta.thumbnail ? 0.3 : 1)
        .attr('stroke', this.getNodeStroke(meta))
        .attr('stroke-width', this.getNodeStrokeWidth(meta))
        .attr('filter', isFocusTarget ? 'url(#focus-glow)' : isFocusNeighbor ? 'url(#neighbor-glow)' : null);

      if (isFocusTarget) {
        inner.insert('circle', ':first-child')
          .attr('r', radius + 9)
          .attr('fill', 'none')
          .attr('stroke', '#22d3ee')
          .attr('stroke-opacity', 0.55)
          .attr('stroke-width', 4)
          .attr('stroke-dasharray', '10 14');
      } else if (isFocusNeighbor) {
        inner.insert('circle', ':first-child')
          .attr('r', radius + 7)
          .attr('fill', 'none')
          .attr('stroke', '#a855f7')
          .attr('stroke-opacity', 0.22)
          .attr('stroke-width', 3);
      }

      // Text label
      this.addTextLabel(inner as any, d.title, radius);
    });

    // Setup click handlers
    merged
      .on('mouseenter', (event: MouseEvent, d) => {
        if ((event as any).buttons) return;
        const outer = d3.select(event.currentTarget as any);
        outer.raise();
        const inner = outer.select('g.node-inner');
        const meta = this.nodeMetadata.get((d as Node).id) || {};
        const hoverScale = this.getFocusScale(meta) * 1.08;
        inner.interrupt();
        inner.transition().duration(120).attr('transform', `scale(${hoverScale})`);
      })
      .on('mouseleave', (event: MouseEvent, d) => {
        const outer = d3.select(event.currentTarget as any);
        const inner = outer.select('g.node-inner');
        const meta = this.nodeMetadata.get((d as Node).id) || {};
        const baseScale = this.getFocusScale(meta);
        inner.interrupt();
        inner.transition().duration(150).attr('transform', `scale(${baseScale})`);
      })
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
    enter
      .attr('opacity', 0)
      .transition()
      .duration(220)
      .attr('opacity', 1);

    enter
      .select('g.node-inner')
      .attr('transform', (d: any) => {
        const meta = this.nodeMetadata.get((d as Node).id) || {};
        return `scale(${this.getFocusScale(meta) * 0.88})`;
      })
      .transition()
      .duration(240)
      .attr('transform', (d: any) => {
        const meta = this.nodeMetadata.get((d as Node).id) || {};
        return `scale(${this.getFocusScale(meta)})`;
      });

    nodeGroups
      .exit()
      .transition()
      .duration(200)
      .attr('opacity', 0)
      .remove();
  }

  private getNodeColor(_nodeId: string, meta: Partial<NodeMetadata>): string {
    if (meta.isInPath) return '#00ff88'; // Green for path
    if (meta.isCurrentlyExploring) return '#ffdd00'; // Yellow for currently exploring
    if (meta.isPathEndpoint) return '#ff8800'; // Orange for selected path endpoints
    if (meta.isBulkSelected) return '#ff8800'; // Orange for bulk-selected
    if (meta.originSeed) {
      const depth = Math.max(0, Math.min(12, meta.originDepth ?? 0));
      const hueOffset = depth * 14;
      const saturation = Math.max(0.42, 0.78 - depth * 0.045);
      const lightness = Math.max(0.34, 0.56 - depth * 0.02);
      return this.hashColor(meta.originSeed, saturation, lightness, hueOffset);
    }
    if (meta.isUserTyped) return '#0088ff'; // Fallback
    if (meta.isAutoDiscovered && meta.colorSeed) return this.hashColor(meta.colorSeed, 0.62); // Cluster by description
    if (meta.isAutoDiscovered) return '#9966ff'; // Purple for auto-discovered (fallback)
    return '#0088ff'; // Default blue (fallback)
  }

  private hashColor(seed: string, saturation: number = 0.65, lightness: number = 0.52, hueOffset: number = 0): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const hue = (Math.abs(hash) + hueOffset) % 360;
    const s = Math.round(saturation * 100);
    const l = Math.round(lightness * 100);
    return `hsl(${hue}, ${s}%, ${l}%)`;
  }

  getNodeMetadata(nodeId: string): NodeMetadata | undefined {
    const meta = this.nodeMetadata.get(nodeId);
    return meta ? { ...meta } : undefined;
  }

  private getNodeStroke(meta: Partial<NodeMetadata>): string {
    if (meta.isFocusTarget) return '#22d3ee';
    if (meta.isFocusNeighbor) return '#a855f7';
    if (meta.isPathEndpoint) return '#ffdd00'; // Yellow stroke for endpoints
    if (meta.isBulkSelected) return '#ffff00'; // Yellow stroke for bulk-selected
    if (meta.isCurrentlyExploring) return '#ff6600'; // Orange stroke for exploring
    if (meta.isExpanded) return '#00ffff'; // Cyan for expanded
    return '#fff';
  }

  private getNodeStrokeWidth(meta: Partial<NodeMetadata>): number {
    if (meta.isFocusTarget) return 6;
    if (meta.isFocusNeighbor) return 4;
    if (meta.isCurrentlyExploring) return 4;
    if (meta.isPathEndpoint) return 5;
    if (meta.isBulkSelected) return 3;
    if (meta.isExpanded) return 3;
    if (meta.isDimmed) return 1;
    return 2;
  }

  private getFocusScale(meta: Partial<NodeMetadata>): number {
    if (meta.isFocusTarget) return 1.18;
    if (meta.isFocusNeighbor) return 1.06;
    return 1;
  }

  private addTextLabel(group: d3.Selection<SVGGElement, any, any, any>, title: string, radius: number) {
    const textElement = group.append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', `${Math.max(7, 9 * this.nodeSizeScale)}px`)
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none');

    // Simple text wrapping
    const words = title.split(/\s+/);
    const maxCharsPerLine = Math.max(6, Math.round(10 * (radius / (45 * this.nodeSizeScale || 1))));
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

    const lineHeight = Math.max(8, 10 * this.nodeSizeScale);
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
          // Drag end (no-op hook kept for future drag end handling)
        }

        d.fx = null;
        d.fy = null;
        this.dragStartPos = null;
      });
  }

  private onTick() {
    // Update link positions
    this.linksGroup.selectAll('g.link line')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    // Keep gradients aligned with current link positions
    this.updateLinkGradients();

    // Update node positions
    this.nodesGroup.selectAll('g.node')
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

  // --- New Helper for Connection Verification ---
  getLinkBetween(sourceId: string, targetId: string): Link | undefined {
    return this.links.find(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return (s === sourceId && t === targetId) || (s === targetId && t === sourceId);
    });
  }

  getLinkById(linkId: string): Link | undefined {
    return this.links.find(l => l.id === linkId);
  }

  getLensingNodes(): Array<{ x: number; y: number; mass: number }> {
    const transform = d3.zoomTransform(this.svg.node()!);

    const degreeById = new Map<string, number>();
    for (const l of this.links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      degreeById.set(s, (degreeById.get(s) || 0) + 1);
      degreeById.set(t, (degreeById.get(t) || 0) + 1);
    }

    const result: Array<{ x: number; y: number; mass: number }> = [];
    for (const n of this.nodes) {
      if (n.x === undefined || n.y === undefined) continue;
      const screenX = transform.applyX(n.x);
      const screenY = transform.applyY(n.y);
      const degree = degreeById.get(n.id) || 0;
      const mass = (0.8 + Math.min(10, degree) * 0.25) * this.nodeSizeScale;
      result.push({ x: screenX, y: screenY, mass });
    }
    return result;
  }

  centerOnNode(nodeId: string, options: { durationMs?: number } = {}) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || node.x === undefined || node.y === undefined) return;
    if (!this.zoomBehavior) return;

    const k = this.currentZoomTransform?.k ?? 1;
    const x = this.width / 2 - k * node.x;
    const y = this.height / 2 - k * node.y;
    const transform = d3.zoomIdentity.translate(x, y).scale(k);

    const duration = options.durationMs ?? 520;
    this.svg
      .transition()
      .duration(duration)
      .call(this.zoomBehavior.transform as any, transform);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.simulation.stop();
    this.svg.selectAll('*').remove();
  }
}
