export type ForestLayoutNode = {
  id: string;
  x?: number;
  y?: number;
};

export type ForestManualPosition = {
  x: number;
  y: number;
};

export type ForestLayoutMetadata = {
  primaryParentId?: string;
  treeId?: string;
  layoutDepth?: number;
  isPinned?: boolean;
  manualPosition?: ForestManualPosition;
  isCollapsed?: boolean;
};

type ForestLayoutInput = {
  nodes: ForestLayoutNode[];
  metadataById: Map<string, ForestLayoutMetadata>;
  width: number;
  height: number;
  treeSpacing: number;
  branchSpread: number;
};

type ForestLayoutResult = {
  targets: Map<string, { x: number; y: number }>;
  childrenByParent: Map<string, string[]>;
  hiddenNodeIds: Set<string>;
  treeIds: string[];
};

const getMeta = (
  metadataById: Map<string, ForestLayoutMetadata>,
  nodeId: string
): ForestLayoutMetadata => metadataById.get(nodeId) || {};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const collectPrimaryChildren = (
  nodeIds: Iterable<string>,
  metadataById: Map<string, ForestLayoutMetadata>
) => {
  const idSet = new Set(nodeIds);
  const childrenByParent = new Map<string, string[]>();

  idSet.forEach((nodeId) => {
    const meta = getMeta(metadataById, nodeId);
    const parentId = meta.primaryParentId;
    if (!parentId || !idSet.has(parentId)) return;
    const existing = childrenByParent.get(parentId) || [];
    existing.push(nodeId);
    childrenByParent.set(parentId, existing);
  });

  childrenByParent.forEach((children, parentId) => {
    children.sort((a, b) => {
      const depthA = getMeta(metadataById, a).layoutDepth ?? 0;
      const depthB = getMeta(metadataById, b).layoutDepth ?? 0;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });
    childrenByParent.set(parentId, children);
  });

  return childrenByParent;
};

export const collectBranchNodeIds = (
  startNodeId: string,
  childrenByParent: Map<string, string[]>,
  options: { includeSelf?: boolean } = {}
) => {
  const includeSelf = options.includeSelf ?? true;
  const result: string[] = [];
  const stack = includeSelf
    ? [startNodeId]
    : [...(childrenByParent.get(startNodeId) || [])];

  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    result.push(nodeId);
    const children = childrenByParent.get(nodeId) || [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }

  return result;
};

export const computeForestLayout = ({
  nodes,
  metadataById,
  width,
  height,
  treeSpacing,
  branchSpread,
}: ForestLayoutInput): ForestLayoutResult => {
  const nodeIds = nodes.map((node) => node.id);
  const childrenByParent = collectPrimaryChildren(nodeIds, metadataById);
  const hiddenNodeIds = new Set<string>();

  const rootIds = nodes
    .map((node) => node.id)
    .filter((nodeId) => {
      const meta = getMeta(metadataById, nodeId);
      return !meta.primaryParentId || !nodeIds.includes(meta.primaryParentId) || meta.treeId === nodeId;
    })
    .sort((a, b) => a.localeCompare(b));

  const collectHiddenDescendants = (nodeId: string) => {
    const descendants = collectBranchNodeIds(nodeId, childrenByParent, { includeSelf: false });
    descendants.forEach((descendantId) => hiddenNodeIds.add(descendantId));
  };

  nodeIds.forEach((nodeId) => {
    if (getMeta(metadataById, nodeId).isCollapsed) {
      collectHiddenDescendants(nodeId);
    }
  });

  const leafCountMemo = new Map<string, number>();
  const countLeaves = (nodeId: string): number => {
    if (leafCountMemo.has(nodeId)) return leafCountMemo.get(nodeId)!;
    const visibleChildren = (childrenByParent.get(nodeId) || []).filter(
      (childId) => !hiddenNodeIds.has(childId)
    );
    if (visibleChildren.length === 0) {
      leafCountMemo.set(nodeId, 1);
      return 1;
    }
    const value = visibleChildren.reduce((sum, childId) => sum + countLeaves(childId), 0);
    leafCountMemo.set(nodeId, value);
    return value;
  };

  const targets = new Map<string, { x: number; y: number }>();
  const visibleRootIds = rootIds.filter((rootId) => !hiddenNodeIds.has(rootId));
  const rootCount = Math.max(visibleRootIds.length, 1);
  const columns = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(rootCount))));
  const rows = Math.max(1, Math.ceil(rootCount / columns));
  const spacingX = clamp(treeSpacing * 2.75, 260, Math.max(260, width * 0.42));
  const spacingY = clamp(treeSpacing * 1.6, 180, Math.max(180, height * 0.34));

  const getRootAnchor = (rootId: string, index: number) => {
    const meta = getMeta(metadataById, rootId);
    if (meta.manualPosition) return meta.manualPosition;

    const row = Math.floor(index / columns);
    const col = index % columns;
    const itemsInRow =
      row === rows - 1 ? Math.max(1, rootCount - row * columns) : Math.min(columns, rootCount);
    const rowStartX = width / 2 - ((itemsInRow - 1) * spacingX) / 2;
    const x = rowStartX + col * spacingX;
    const y = clamp(height * 0.22 + row * spacingY, 120, Math.max(140, height - 240));
    return { x, y };
  };

  const placeNode = (
    nodeId: string,
    x: number,
    y: number,
    spanWidth: number,
    depth: number
  ) => {
    targets.set(nodeId, { x, y });
    const visibleChildren = (childrenByParent.get(nodeId) || []).filter(
      (childId) => !hiddenNodeIds.has(childId)
    );

    if (visibleChildren.length === 0) return;

    const totalLeaves = visibleChildren.reduce((sum, childId) => sum + countLeaves(childId), 0);
    const totalSpan = Math.max(spanWidth, visibleChildren.length * branchSpread * 0.95);
    let cursor = x - totalSpan / 2;

    visibleChildren.forEach((childId, index) => {
      const leafCount = countLeaves(childId);
      const childSpan = Math.max(branchSpread * 0.92, (totalSpan * leafCount) / Math.max(totalLeaves, 1));
      const childMeta = getMeta(metadataById, childId);
      const verticalDepth = childMeta.layoutDepth ?? depth + 1;
      const sway =
        Math.sin((index + 1) * 1.18 + depth * 0.65) *
        Math.min(branchSpread * 0.15, 26);
      const childX = cursor + childSpan / 2 + sway;
      const childY = y + treeSpacing * (verticalDepth > depth + 1 ? 1.15 : 1);
      placeNode(childId, childX, childY, childSpan * 0.9, depth + 1);
      cursor += childSpan;
    });
  };

  visibleRootIds.forEach((rootId, index) => {
    const rootAnchor = getRootAnchor(rootId, index);
    const rootSpan = Math.max(branchSpread * 2.2, countLeaves(rootId) * branchSpread * 0.92);
    placeNode(rootId, rootAnchor.x, rootAnchor.y, rootSpan, 0);
  });

  nodes.forEach((node) => {
    if (targets.has(node.id) || hiddenNodeIds.has(node.id)) return;
    const meta = getMeta(metadataById, node.id);
    const fallbackX = meta.manualPosition?.x ?? node.x ?? width / 2;
    const fallbackY = meta.manualPosition?.y ?? node.y ?? height / 2;
    targets.set(node.id, { x: fallbackX, y: fallbackY });
  });

  return {
    targets,
    childrenByParent,
    hiddenNodeIds,
    treeIds: visibleRootIds,
  };
};
