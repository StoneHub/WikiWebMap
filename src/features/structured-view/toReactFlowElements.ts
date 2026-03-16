import { MarkerType, Position, type Edge, type Node } from '@xyflow/react';
import type { GraphStateSnapshot, Node as GraphNode, NodeMetadata } from '../../GraphManager';
import { computeStructuredLayout } from './structuredLayout';

export type StructuredFlowNodeData = {
  title: string;
  subtitle?: string;
  degree: number;
  depth: number;
  role: 'root' | 'branch' | 'leaf';
  accentColor: string;
  isSelected: boolean;
  isPathNode: boolean;
  isPathEndpoint: boolean;
  isExpanded: boolean;
  isCollapsed: boolean;
};

export type StructuredFlowNode = Node<StructuredFlowNodeData, 'structuredTopic'>;

const getMeta = (
  metadataById: Record<string, NodeMetadata>,
  nodeId: string
): Partial<NodeMetadata> => metadataById[nodeId] || {};

const hashColor = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 58%)`;
};

export const toStructuredFlowElements = ({
  snapshot,
  nodeDescriptions,
  clickedNodeId,
  pathSelectedNodeIds,
  showCrossLinks,
  preferredRootOrder,
}: {
  snapshot: GraphStateSnapshot;
  nodeDescriptions: Record<string, string>;
  clickedNodeId: string | null;
  pathSelectedNodeIds: Set<string>;
  showCrossLinks: boolean;
  preferredRootOrder: string[];
}): {
  nodes: StructuredFlowNode[];
  edges: Edge[];
  sourceNodesById: Record<string, GraphNode>;
} => {
  const layout = computeStructuredLayout({
    snapshot,
    preferredRootOrder,
  });

  const visibleNodeIds = new Set(
    snapshot.nodes
      .map((node) => node.id)
      .filter((nodeId) => !layout.hiddenNodeIds.has(nodeId) && layout.positions.has(nodeId))
  );

  const degreeById = new Map<string, number>();
  snapshot.links.forEach((link) => {
    const sourceId = link.source;
    const targetId = link.target;
    if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) return;
    degreeById.set(sourceId, (degreeById.get(sourceId) || 0) + 1);
    degreeById.set(targetId, (degreeById.get(targetId) || 0) + 1);
  });

  const sourceNodesById: Record<string, GraphNode> = {};
  snapshot.nodes.forEach((node) => {
    sourceNodesById[node.id] = node;
  });

  const nodes: StructuredFlowNode[] = snapshot.nodes
    .filter((node) => visibleNodeIds.has(node.id))
    .map((node) => {
      const meta = getMeta(snapshot.nodeMetadata, node.id);
      const position = layout.positions.get(node.id) || { x: 0, y: 0 };
      const visibleChildren = (layout.childrenByParent.get(node.id) || []).filter(
        (childId) => visibleNodeIds.has(childId)
      );
      const role: StructuredFlowNodeData['role'] =
        meta.colorRole === 'root' || layout.rootIds.includes(node.id)
          ? 'root'
          : visibleChildren.length > 0
            ? 'branch'
            : 'leaf';

      return {
        id: node.id,
        type: 'structuredTopic',
        position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: false,
        selectable: true,
        data: {
          title: node.title,
          subtitle: nodeDescriptions[node.title],
          degree: degreeById.get(node.id) || 0,
          depth: meta.layoutDepth ?? meta.originDepth ?? 0,
          role,
          accentColor: hashColor(meta.originSeed || meta.treeId || node.id),
          isSelected: clickedNodeId === node.id,
          isPathNode: Boolean(meta.isInPath),
          isPathEndpoint: pathSelectedNodeIds.has(node.id),
          isExpanded: Boolean(meta.isExpanded),
          isCollapsed: Boolean(meta.isCollapsed),
        },
      };
    });

  const edges = snapshot.links.reduce<Edge[]>((result, link) => {
    const sourceId = link.source;
    const targetId = link.target;
    if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) return result;

    const isCrossLink = link.layoutRole === 'cross';
    if (isCrossLink && !showCrossLinks) return result;

    const sourceMeta = getMeta(snapshot.nodeMetadata, sourceId);
    const targetMeta = getMeta(snapshot.nodeMetadata, targetId);
    const isPathLink =
      link.type === 'path' ||
      (Boolean(sourceMeta.isInPath) && Boolean(targetMeta.isInPath));
    const accentColor = hashColor(sourceMeta.originSeed || sourceMeta.treeId || sourceId);
    const stroke = isPathLink ? '#f59e0b' : isCrossLink ? '#94a3b8' : accentColor;

    result.push({
      id: link.id,
      source: sourceId,
      target: targetId,
      type: isCrossLink ? 'default' : 'smoothstep',
      animated: isPathLink,
      style: {
        stroke,
        strokeWidth: isPathLink ? 4 : isCrossLink ? 1.8 : 3,
        strokeDasharray: isCrossLink ? '10 8' : undefined,
        opacity: isPathLink ? 0.95 : isCrossLink ? 0.46 : 0.82,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: isCrossLink ? 14 : 18,
        height: isCrossLink ? 14 : 18,
        color: stroke,
      },
      zIndex: isCrossLink ? 0 : 1,
    });

    return result;
  }, []);

  return { nodes, edges, sourceNodesById };
};
