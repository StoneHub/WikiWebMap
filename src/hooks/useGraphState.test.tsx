import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GraphManager, GraphStateSnapshot, NodeMetadata } from '../GraphManager';
import type { UpdateQueue } from '../UpdateQueue';
import { WikiService } from '../WikiService';
import { useGraphState } from './useGraphState';

function createMetadata(overrides: Partial<NodeMetadata> = {}): NodeMetadata {
  return {
    isUserTyped: false,
    isAutoDiscovered: false,
    isExpanded: false,
    isInPath: false,
    isRecentlyAdded: false,
    isCurrentlyExploring: false,
    isSelected: false,
    isPathEndpoint: false,
    isBulkSelected: false,
    isDimmed: false,
    isDimmedByPath: false,
    ...overrides,
  };
}

function renderUseGraphStateHook() {
  let latest: ReturnType<typeof useGraphState> | null = null;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  function Harness() {
    latest = useGraphState();
    return null;
  }

  act(() => {
    root.render(<Harness />);
  });

  return {
    getCurrent() {
      if (!latest) {
        throw new Error('Hook did not render.');
      }
      return latest;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useGraphState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures, resets, and restores graph state deterministically', () => {
    const rendered = renderUseGraphStateHook();
    const current = rendered.getCurrent();

    const graphSnapshot: GraphStateSnapshot = {
      nodes: [{ id: 'Physics', title: 'Physics' }],
      links: [{ id: 'Physics-Mathematics', source: 'Physics', target: 'Mathematics', type: 'manual', context: 'Physics mentions Mathematics.' }],
      nodeMetadata: {
        Physics: createMetadata({ isUserTyped: true }),
      },
    };

    const graphManagerFns = {
      clear: vi.fn(),
      getStateSnapshot: vi.fn(() => graphSnapshot),
      setStateSnapshot: vi.fn(),
      deleteNode: vi.fn(),
      pruneNodes: vi.fn(() => 0),
      getNodeIds: vi.fn(() => []),
      getNodeDegree: vi.fn(() => 0),
    };

    const graphManager = graphManagerFns as unknown as GraphManager;

    const updateQueueFns = {
      clear: vi.fn(),
    };
    const updateQueue = updateQueueFns as unknown as UpdateQueue;

    act(() => {
      current.graphManagerRef.current = graphManager;
      current.updateQueueRef.current = updateQueue;
      current.setUserTypedNodes(new Set(['Physics']));
      current.setAutoDiscoveredNodes(new Set(['Mathematics']));
      current.setExpandedNodes(new Set(['Physics']));
      current.setPathNodes(new Set(['Physics', 'Mathematics']));
      current.setRecentlyAddedNodes(new Set(['Mathematics']));
      current.setPathSelectedNodes([{ id: 'Physics', title: 'Physics' }]);
      current.setBulkSelectedNodes([{ id: 'Mathematics', title: 'Mathematics' }]);
      current.setNodeThumbnails({ Physics: 'thumb.png' });
      current.setNodeDescriptions({ Physics: 'Fundamental science' });
      current.setNodeCategories({ Physics: ['Science'] });
      current.setNodeBacklinkCounts({ Physics: 12 });
      current.setClickedNode({ id: 'Physics', title: 'Physics' });
      current.setClickedSummary('Physics summary');
    });

    const snapshot = rendered.getCurrent().captureSnapshot();
    expect(snapshot).not.toBeNull();

    act(() => {
      rendered.getCurrent().resetGraphState();
    });

    const resetState = rendered.getCurrent();
    expect(graphManagerFns.clear).toHaveBeenCalledTimes(1);
    expect(updateQueueFns.clear).toHaveBeenCalledTimes(1);
    expect(resetState.userTypedNodes.size).toBe(0);
    expect(resetState.autoDiscoveredNodes.size).toBe(0);
    expect(resetState.pathNodes.size).toBe(0);
    expect(resetState.pathSelectedNodes).toEqual([]);
    expect(resetState.bulkSelectedNodes).toEqual([]);
    expect(resetState.nodeDescriptions).toEqual({});
    expect(resetState.clickedNode).toBeNull();
    expect(resetState.clickedSummary).toBe('');

    act(() => {
      rendered.getCurrent().restoreSnapshot(snapshot!);
    });

    const restoredState = rendered.getCurrent();
    expect(graphManagerFns.setStateSnapshot).toHaveBeenCalledWith(graphSnapshot);
    expect(Array.from(restoredState.userTypedNodes)).toEqual(['Physics']);
    expect(Array.from(restoredState.autoDiscoveredNodes)).toEqual(['Mathematics']);
    expect(Array.from(restoredState.pathNodes)).toEqual(['Physics', 'Mathematics']);
    expect(restoredState.nodeDescriptions).toEqual({ Physics: 'Fundamental science' });
    expect(restoredState.nodeCategories).toEqual({ Physics: ['Science'] });
    expect(restoredState.nodeBacklinkCounts).toEqual({ Physics: 12 });
    expect(restoredState.clickedNode).toBeNull();
    expect(restoredState.clickedSummary).toBe('');

    rendered.unmount();
  });

  it('limits the initial seed burst to a calmer set of leaves', async () => {
    const rendered = renderUseGraphStateHook();
    const current = rendered.getCurrent();

    const graphManagerFns = {
      getNodeIds: vi.fn(() => []),
      getViewportCenter: vi.fn(() => ({ x: 0, y: 0 })),
      setNodeMetadata: vi.fn(),
      getStateSnapshot: vi.fn(() => ({
        nodes: [],
        links: [],
        nodeMetadata: {},
      })),
    };

    const queueUpdate = vi.fn();
    const updateQueueFns = {
      queueUpdate,
    };

    vi.spyOn(WikiService, 'resolveTitle').mockResolvedValue('Physics');
    vi.spyOn(WikiService, 'fetchLinks').mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        title: `Outlink ${index + 1}`,
        context: `Context ${index + 1}`,
      }))
    );
    vi.spyOn(WikiService, 'fetchSummary').mockResolvedValue({
      title: 'Physics',
      extract: 'Physics summary',
      summary: 'Physics summary',
      description: 'Scientific field',
    });
    vi.spyOn(WikiService, 'fetchCategories').mockResolvedValue(['Science']);
    vi.spyOn(WikiService, 'fetchBacklinks').mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => `Backlink ${index + 1}`)
    );
    vi.spyOn(WikiService, 'getCachedNodes').mockReturnValue([]);

    act(() => {
      current.graphManagerRef.current = graphManagerFns as unknown as GraphManager;
      current.updateQueueRef.current = updateQueueFns as unknown as UpdateQueue;
    });

    await act(async () => {
      await rendered.getCurrent().addTopic('Physics', true);
    });

    expect(queueUpdate).toHaveBeenCalledTimes(1);
    const [queuedNodes, queuedLinks] = queueUpdate.mock.calls[0] as [Array<{ id: string }>, Array<{ id: string }>];
    expect(queuedNodes).toHaveLength(13);
    expect(queuedLinks).toHaveLength(12);
    expect(queuedNodes[0]?.id).toBe('Physics');

    rendered.unmount();
  });
});
