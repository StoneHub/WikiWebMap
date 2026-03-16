import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  Position,
  useReactFlow,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
  type Edge,
} from '@xyflow/react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useEffect } from 'react';
import type { GraphStateSnapshot, Node as GraphNode } from '../GraphManager';
import {
  toStructuredFlowElements,
  type StructuredFlowNode,
  type StructuredFlowNodeData,
} from '../features/structured-view/toReactFlowElements';
import '@xyflow/react/dist/style.css';

const hiddenHandleStyle: CSSProperties = {
  opacity: 0,
  width: 10,
  height: 10,
  border: 'none',
};

function StructuredTopicNode(props: NodeProps) {
  const { selected } = props;
  const data = props.data as StructuredFlowNodeData;
  const isActive = selected || data.isSelected;
  const shellStyle: CSSProperties = {
    width: data.role === 'root' ? 252 : 224,
    boxShadow: isActive
      ? `0 0 0 1px ${data.accentColor}, 0 24px 48px rgba(2, 6, 23, 0.48)`
      : '0 18px 40px rgba(2, 6, 23, 0.34)',
  };
  const accentStyle: CSSProperties = {
    backgroundColor: data.accentColor,
  };

  return (
    <div
      className={`structured-node relative overflow-hidden rounded-[1.4rem] border bg-slate-950/92 backdrop-blur-xl ${
        isActive ? 'border-slate-100/40' : 'border-slate-700/70'
      } ${data.role === 'root' ? 'px-5 py-4' : 'px-4 py-3.5'}`}
      style={shellStyle}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandleStyle} />
      <Handle type="source" position={Position.Right} style={hiddenHandleStyle} />

      <div className="absolute inset-x-5 top-0 h-1 rounded-b-full" style={accentStyle} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {data.role === 'root' ? 'Seed Topic' : data.role === 'branch' ? 'Branch Topic' : 'Leaf Topic'}
          </div>
          <div className="mt-2 text-sm font-semibold leading-tight text-slate-50">
            {data.title}
          </div>
        </div>
        <div
          className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold text-slate-950"
          style={accentStyle}
        >
          D{data.depth}
        </div>
      </div>

      {data.subtitle && (
        <div
          className="mt-3 text-[11px] leading-relaxed text-slate-300/90"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.subtitle}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-slate-700/70 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-300">
          {data.degree} links
        </span>
        {data.isPathNode && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/12 px-2 py-1 text-[10px] text-amber-100">
            Path
          </span>
        )}
        {data.isPathEndpoint && (
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/12 px-2 py-1 text-[10px] text-cyan-100">
            Endpoint
          </span>
        )}
        {data.isCollapsed && (
          <span className="rounded-full border border-slate-500/30 bg-slate-700/20 px-2 py-1 text-[10px] text-slate-200">
            Collapsed
          </span>
        )}
        {!data.isCollapsed && data.isExpanded && (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-100">
            Expanded
          </span>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  structuredTopic: StructuredTopicNode,
};

function StructuredFlowCanvas(props: {
  snapshot: GraphStateSnapshot;
  nodeDescriptions: Record<string, string>;
  clickedNodeId: string | null;
  pathSelectedNodeIds: Set<string>;
  showCrossLinks: boolean;
  preferredRootOrder: string[];
  onNodeSelect: (node: GraphNode, event: ReactMouseEvent) => void;
  onPaneClick: () => void;
}) {
  const { fitView } = useReactFlow<StructuredFlowNode, Edge>();
  const { nodes, edges, sourceNodesById } = toStructuredFlowElements({
    snapshot: props.snapshot,
    nodeDescriptions: props.nodeDescriptions,
    clickedNodeId: props.clickedNodeId,
    pathSelectedNodeIds: props.pathSelectedNodeIds,
    showCrossLinks: props.showCrossLinks,
    preferredRootOrder: props.preferredRootOrder,
  });

  useEffect(() => {
    if (nodes.length === 0) return;
    window.setTimeout(() => {
      void fitView({ padding: 0.24, duration: 350, maxZoom: 1.1 });
    }, 0);
  }, [fitView, nodes.length, edges.length]);

  const handleNodeClick: NodeMouseHandler<StructuredFlowNode> = (event, node) => {
    const sourceNode = sourceNodesById[node.id];
    if (!sourceNode) return;
    props.onNodeSelect(sourceNode, event as ReactMouseEvent);
  };

  return (
    <ReactFlow<StructuredFlowNode, Edge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onPaneClick={() => props.onPaneClick()}
      panOnScroll
      minZoom={0.25}
      maxZoom={1.5}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      elevateEdgesOnSelect={false}
      selectNodesOnDrag={false}
      onlyRenderVisibleElements
      colorMode="dark"
      className="structured-flow"
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ interactionWidth: 24 }}
    >
      <Background
        id="structured-minor-grid"
        variant={BackgroundVariant.Lines}
        gap={42}
        size={1}
        color="rgba(96, 165, 250, 0.12)"
      />
      <Background
        id="structured-major-grid"
        variant={BackgroundVariant.Lines}
        gap={168}
        offset={84}
        size={1}
        color="rgba(148, 163, 184, 0.12)"
      />
      <Panel position="top-left" className="!m-4 max-w-sm">
        <div className="rounded-[1.6rem] border border-slate-700/70 bg-slate-950/82 px-4 py-3 shadow-[0_18px_48px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-200/80">
            Structured View Beta
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-100">
            A branch-first map with stable lanes, stronger hierarchy, and dashed bridge edges for cross-links.
          </div>
        </div>
      </Panel>
      <Controls
        showInteractive={false}
        className="!rounded-2xl !border !border-slate-700/70 !bg-slate-950/90 !shadow-2xl !backdrop-blur-xl"
      />
    </ReactFlow>
  );
}

export function StructuredFlowView(props: {
  snapshot: GraphStateSnapshot;
  nodeDescriptions: Record<string, string>;
  clickedNodeId: string | null;
  pathSelectedNodeIds: Set<string>;
  showCrossLinks: boolean;
  preferredRootOrder: string[];
  onNodeSelect: (node: GraphNode, event: ReactMouseEvent) => void;
  onPaneClick: () => void;
}) {
  return (
    <div className="absolute inset-0 z-0">
      <ReactFlowProvider>
        <StructuredFlowCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
