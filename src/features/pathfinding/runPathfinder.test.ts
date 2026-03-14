import type { SetStateAction } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphManager, Node } from '../../GraphManager';
import { WikiService } from '../../WikiService';
import { runPathfinder } from './runPathfinder';
import type { SearchProgress } from '../../types/SearchProgress';

function applyStateUpdate<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (prevState: T) => T)(current) : next;
}

function createSearchProgress(): SearchProgress {
  return {
    isSearching: false,
    isPaused: false,
    keepSearching: false,
    currentDepth: 0,
    maxDepth: 6,
    currentPage: '',
    exploredCount: 0,
    queueSize: 0,
    exploredNodes: new Set<string>(),
  };
}

function createHarness() {
  const graphManagerFns = {
    addNodes: vi.fn(),
    addLinks: vi.fn(),
    setNodesMetadata: vi.fn(),
    highlightNode: vi.fn(),
  };

  const graphManager = graphManagerFns as unknown as GraphManager;

  const state = {
    loading: false,
    searchLog: [] as string[],
    searchProgress: createSearchProgress(),
    pathNodes: new Set<string>(),
    error: '',
    pathSelectedNodes: [] as Node[],
  };

  return {
    graphManagerFns,
    state,
    args: {
      startInput: 'Physics',
      endInput: 'Science',
      maxDepth: 4,
      keepSearchingRef: { current: false },
      graphManagerRef: { current: graphManager },
      searchAbortRef: { current: false },
      searchPauseRef: { current: false },
      setLoading: (next: SetStateAction<boolean>) => {
        state.loading = applyStateUpdate(state.loading, next);
      },
      setSearchLog: (next: SetStateAction<string[]>) => {
        state.searchLog = applyStateUpdate(state.searchLog, next);
      },
      setSearchProgress: (next: SetStateAction<SearchProgress>) => {
        state.searchProgress = applyStateUpdate(state.searchProgress, next);
      },
      setPathNodes: (next: SetStateAction<Set<string>>) => {
        state.pathNodes = applyStateUpdate(state.pathNodes, next);
      },
      setError: (next: SetStateAction<string>) => {
        state.error = applyStateUpdate(state.error, next);
      },
      setPathSelectedNodes: (next: SetStateAction<Node[]>) => {
        state.pathSelectedNodes = applyStateUpdate(state.pathSelectedNodes, next);
      },
      onFoundPath: vi.fn(),
    },
  };
}

describe('runPathfinder', () => {
  beforeEach(() => {
    vi.spyOn(WikiService, 'resolveTitle').mockImplementation(async title => title);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a path, updates graph state, and returns completion metadata', async () => {
    const harness = createHarness();

    vi.spyOn(WikiService, 'fetchLinks').mockImplementation(async title => {
      if (title === 'Physics') return [{ title: 'Mathematics', context: 'Physics references Mathematics.' }];
      if (title === 'Mathematics') return [{ title: 'Science', context: 'Mathematics references Science.' }];
      return [];
    });
    vi.spyOn(WikiService, 'getLinksFromCache').mockImplementation(title => {
      if (title === 'Physics') return [{ title: 'Mathematics', context: 'Physics references Mathematics.' }];
      if (title === 'Mathematics') return [{ title: 'Science', context: 'Mathematics references Science.' }];
      return undefined;
    });

    const result = await runPathfinder(harness.args);

    expect(result).toEqual({ status: 'completed', foundPathCount: 1 });
    expect(Array.from(harness.state.pathNodes)).toEqual(['Physics', 'Mathematics', 'Science']);
    expect(harness.graphManagerFns.addNodes).toHaveBeenCalled();
    expect(harness.graphManagerFns.addLinks).toHaveBeenCalled();
    expect(harness.args.onFoundPath).toHaveBeenCalledWith({
      triggerLinkId: 'Mathematics-Science',
      path: ['Physics', 'Mathematics', 'Science'],
    });
    expect(harness.state.error).toBe('');
  });

  it('returns aborted when a search is cancelled after the current fetch', async () => {
    const harness = createHarness();

    vi.spyOn(WikiService, 'fetchLinks').mockImplementation(async () => {
      harness.args.searchAbortRef.current = true;
      return [{ title: 'Mathematics', context: 'Physics references Mathematics.' }];
    });
    vi.spyOn(WikiService, 'getLinksFromCache').mockReturnValue(undefined);

    const result = await runPathfinder(harness.args);

    expect(result).toEqual({ status: 'aborted', foundPathCount: 0 });
    expect(harness.graphManagerFns.addNodes).not.toHaveBeenCalled();
    expect(harness.state.searchLog.some(entry => entry.includes('cancelled'))).toBe(true);
  });

  it('reports not_found when no path exists within the search depth', async () => {
    const harness = createHarness();

    vi.spyOn(WikiService, 'fetchLinks').mockResolvedValue([]);
    vi.spyOn(WikiService, 'getLinksFromCache').mockReturnValue(undefined);

    const result = await runPathfinder(harness.args);

    expect(result).toEqual({ status: 'not_found', foundPathCount: 0 });
    expect(harness.state.error).toContain('No path found');
    expect(harness.state.searchLog.some(entry => entry.includes('Target not found'))).toBe(true);
  });
});
