import type { GraphStateSnapshot, NodeMetadata } from '../../GraphManager';

type StructuredLayoutResult = {
  positions: Map<string, { x: number; y: number }>;
  hiddenNodeIds: Set<string>;
  rootIds: string[];
  childrenByParent: Map<string, string[]>;
};

const COLUMN_GAP = 310;
const ROW_GAP = 116;
const ROOT_GAP = 180;
const START_X = 110;
const START_Y = 90;

const getMeta = (
  metadataById: Record<string, NodeMetadata>,
  nodeId: string
): Partial<NodeMetadata> => metadataById[nodeId] || {};

const sortByPreferredOrder = (preferredOrder: string[]) => {
  const preferredIndex = new Map(preferredOrder.map((id, index) => [id, index]));
  return (left: string, right: string) => {
    const leftIndex = preferredIndex.get(left);
    const rightIndex = preferredIndex.get(right);

    if (leftIndex !== undefined || rightIndex !== undefined) {
      if (leftIndex === undefined) return 1;
      if (rightIndex === undefined) return -1;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  };
};

export const computeStructuredLayout = ({
  snapshot,
  preferredRootOrder = [],
}: {
  snapshot: GraphStateSnapshot;
  preferredRootOrder?: string[];
}): StructuredLayoutResult => {
  const nodeIds = snapshot.nodes.map((node) => node.id);
  const idSet = new Set(nodeIds);
  const metadataById = snapshot.nodeMetadata || {};
  const childrenByParent = new Map<string, string[]>();

  nodeIds.forEach((nodeId) => {
    const parentId = getMeta(metadataById, nodeId).primaryParentId;
    if (!parentId || !idSet.has(parentId)) return;
    const children = childrenByParent.get(parentId) || [];
    children.push(nodeId);
    childrenByParent.set(parentId, children);
  });

  const nodeSorter = sortByPreferredOrder(preferredRootOrder);
  childrenByParent.forEach((children, parentId) => {
    children.sort((left, right) => {
      const leftDepth = getMeta(metadataById, left).layoutDepth ?? 0;
      const rightDepth = getMeta(metadataById, right).layoutDepth ?? 0;
      if (leftDepth !== rightDepth) return leftDepth - rightDepth;
      return nodeSorter(left, right);
    });
    childrenByParent.set(parentId, children);
  });

  const hiddenNodeIds = new Set<string>();
  const hideDescendants = (nodeId: string) => {
    const children = childrenByParent.get(nodeId) || [];
    children.forEach((childId) => {
      hiddenNodeIds.add(childId);
      hideDescendants(childId);
    });
  };

  nodeIds.forEach((nodeId) => {
    if (getMeta(metadataById, nodeId).isCollapsed) {
      hideDescendants(nodeId);
    }
  });

  const rootIds = nodeIds
    .filter((nodeId) => {
      const meta = getMeta(metadataById, nodeId);
      return !meta.primaryParentId || !idSet.has(meta.primaryParentId) || meta.treeId === nodeId;
    })
    .filter((nodeId) => !hiddenNodeIds.has(nodeId))
    .sort(nodeSorter);

  const leafCountMemo = new Map<string, number>();
  const countVisibleLeaves = (nodeId: string): number => {
    const cached = leafCountMemo.get(nodeId);
    if (cached !== undefined) return cached;

    const visibleChildren = (childrenByParent.get(nodeId) || []).filter(
      (childId) => !hiddenNodeIds.has(childId)
    );

    if (visibleChildren.length === 0) {
      leafCountMemo.set(nodeId, 1);
      return 1;
    }

    const total = visibleChildren.reduce((sum, childId) => sum + countVisibleLeaves(childId), 0);
    leafCountMemo.set(nodeId, total);
    return total;
  };

  const positions = new Map<string, { x: number; y: number }>();

  const placeNode = (nodeId: string, depth: number, centerY: number) => {
    positions.set(nodeId, {
      x: START_X + depth * COLUMN_GAP + (depth % 2 === 0 ? 0 : 18),
      y: centerY,
    });

    const visibleChildren = (childrenByParent.get(nodeId) || []).filter(
      (childId) => !hiddenNodeIds.has(childId)
    );
    if (visibleChildren.length === 0) return;

    const totalSpan = visibleChildren.reduce(
      (sum, childId) => sum + Math.max(ROW_GAP, countVisibleLeaves(childId) * ROW_GAP),
      0
    );

    let cursorY = centerY - totalSpan / 2;
    visibleChildren.forEach((childId) => {
      const childSpan = Math.max(ROW_GAP, countVisibleLeaves(childId) * ROW_GAP);
      const childCenterY = cursorY + childSpan / 2;
      placeNode(childId, depth + 1, childCenterY);
      cursorY += childSpan;
    });
  };

  let cursorY = START_Y;
  rootIds.forEach((rootId) => {
    const treeSpan = Math.max(ROW_GAP, countVisibleLeaves(rootId) * ROW_GAP);
    const centerY = cursorY + treeSpan / 2;
    placeNode(rootId, 0, centerY);
    cursorY += treeSpan + ROOT_GAP;
  });

  snapshot.nodes.forEach((node) => {
    if (positions.has(node.id) || hiddenNodeIds.has(node.id)) return;
    const fallbackX = node.x ?? START_X;
    const fallbackY = node.y ?? START_Y;
    positions.set(node.id, { x: fallbackX, y: fallbackY });
  });

  return {
    positions,
    hiddenNodeIds,
    rootIds,
    childrenByParent,
  };
};
