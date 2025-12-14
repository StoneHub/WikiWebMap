import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { GraphManager, Link, Node } from '../../GraphManager';
import { WikiService } from '../../WikiService';
import type { SearchProgress } from '../../types/SearchProgress';

export async function runPathfinder(args: {
  startInput: string;
  endInput: string;
  maxDepth: number;
  keepSearchingRef: MutableRefObject<boolean>;
  graphManagerRef: MutableRefObject<GraphManager | null>;
  searchAbortRef: MutableRefObject<boolean>;
  searchPauseRef: MutableRefObject<boolean>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSearchLog: Dispatch<SetStateAction<string[]>>;
  setSearchProgress: Dispatch<SetStateAction<SearchProgress>>;
  setPathNodes: Dispatch<SetStateAction<Set<string>>>;
  setError: Dispatch<SetStateAction<string>>;
  setPathSelectedNodes: Dispatch<SetStateAction<Node[]>>;
  onFoundPath?: (args: { triggerLinkId: string; path: string[] }) => void;
}) {
  args.setLoading(true);
  args.setSearchLog(['Initializing PathFinder protocol...']);
  let startTitle = args.startInput;
  let endTitle = args.endInput;

  try {
    args.setSearchLog(prev => [...prev, `Resolving targets: "${args.startInput}" / "${args.endInput}"`]);
    const [rStart, rEnd] = await Promise.all([
      WikiService.resolveTitle(args.startInput),
      WikiService.resolveTitle(args.endInput),
    ]);
    startTitle = rStart;
    endTitle = rEnd;
    args.setSearchLog(prev => [...prev, `Target Lock: "${startTitle}" → "${endTitle}"`]);
  } catch {
    args.setSearchLog(prev => [...prev, `Resolution warning. Proceeding with raw inputs.`]);
  }

  args.setSearchProgress({
    isSearching: true,
    isPaused: false,
    keepSearching: args.keepSearchingRef.current,
    currentDepth: 0,
    maxDepth: args.maxDepth,
    exploredCount: 0,
    currentPage: startTitle,
    queueSize: 1,
    exploredNodes: new Set([startTitle]),
  });
  args.setPathNodes(new Set());
  args.setError('');
  args.searchAbortRef.current = false;
  args.searchPauseRef.current = false;

  const queue: { title: string; depth: number }[] = [{ title: startTitle, depth: 0 }];
  const depthByNode = new Map<string, number>([[startTitle, 0]]);
  const parentsByNode = new Map<string, Set<string>>();
  let foundDepth: number | null = null;
  let nodesExplored = 0;

  const buildPaths = (maxPaths: number) => {
    const results: string[][] = [];
    const stack: string[] = [endTitle];

    const dfs = (current: string) => {
      if (results.length >= maxPaths) return;
      if (current === startTitle) {
        results.push([...stack].reverse());
        return;
      }
      const parents = parentsByNode.get(current);
      if (!parents || parents.size === 0) return;
      for (const parent of parents) {
        stack.push(parent);
        dfs(parent);
        stack.pop();
        if (results.length >= maxPaths) return;
      }
    };

    dfs(endTitle);
    return results;
  };

  try {
    while (queue.length > 0) {
      if (args.searchAbortRef.current) break;
      while (args.searchPauseRef.current && !args.searchAbortRef.current) {
        await new Promise(r => setTimeout(r, 120));
      }
      const { title, depth } = queue.shift()!;

      if (foundDepth !== null && depth >= foundDepth) {
        // We've already found the shortest path length; no need to explore deeper for more shortest paths.
        break;
      }

      nodesExplored++;
      if (nodesExplored % 3 === 0) {
        args.setSearchLog(prev => {
          const newLogs = [...prev, `Scanning: ${title.substring(0, 20)}... (D${depth})`];
          return newLogs.slice(-8);
        });
      }

      if (nodesExplored % 5 === 0) {
        args.setSearchProgress(prev => ({
          ...prev,
          exploredCount: nodesExplored,
          currentDepth: depth,
          currentPage: title,
          queueSize: queue.length,
          keepSearching: args.keepSearchingRef.current,
        }));
        await new Promise(r => setTimeout(r, 0));
      }

      if (depth >= args.maxDepth) continue;
      if (nodesExplored > 500) throw new Error(`Exceeded exploration limit (500 nodes).`);

      const links = await WikiService.fetchLinks(title);

      for (const linkObj of links) {
        const link = linkObj.title;
        const nextDepth = depth + 1;
        if (nextDepth > args.maxDepth) continue;

        const knownDepth = depthByNode.get(link);
        if (knownDepth === undefined) {
          depthByNode.set(link, nextDepth);
          parentsByNode.set(link, new Set([title]));
          queue.push({ title: link, depth: nextDepth });
        } else if (knownDepth === nextDepth) {
          const set = parentsByNode.get(link) || new Set<string>();
          set.add(title);
          parentsByNode.set(link, set);
        } else {
          continue;
        }

        if (link === endTitle) {
          if (foundDepth === null) {
            foundDepth = nextDepth;
            args.setSearchLog(prev => [...prev, `>> TARGET ACQUIRED @ depth ${foundDepth} <<`].slice(-8));
          }
        }
      }
    }

    if (foundDepth === null) {
      if (!args.searchAbortRef.current) {
        args.setError('No path found within search limits.');
        args.setSearchLog(prev => [...prev, `[FAILURE] Target not found in search horizon.`].slice(-8));
      }
      return;
    }

    const keepSearching = args.keepSearchingRef.current;
    const paths = keepSearching ? buildPaths(5) : buildPaths(1);

    if (paths.length === 0) {
      args.setError('Path found but could not be reconstructed.');
      args.setSearchLog(prev => [...prev, `[ERROR] Failed to reconstruct path.`].slice(-8));
      return;
    }

    paths.forEach((path, index) => {
      const newNodes: Node[] = path.map(p => ({ id: p, title: p }));
      const newLinks: Link[] = [];
      for (let i = 0; i < path.length - 1; i++) {
        const source = path[i];
        const target = path[i + 1];
        const sourceLinks = WikiService.getLinksFromCache(source);
        const context = sourceLinks?.find(l => l.title === target)?.context;
        newLinks.push({
          source,
          target,
          id: `${source}-${target}`,
          type: 'path',
          context,
        });
      }

      if (args.graphManagerRef.current) {
        args.graphManagerRef.current.addNodes(newNodes);
        args.graphManagerRef.current.addLinks(newLinks);
        if (index === 0) args.setPathNodes(new Set(path));

        const updates = path.map(p => ({ nodeId: p, metadata: { isInPath: true } }));
        args.graphManagerRef.current.setNodesMetadata(updates);
        args.graphManagerRef.current.highlightNode(null);
      }

      const triggerLinkId = `${path[path.length - 2]}-${endTitle}`;
      args.onFoundPath?.({ triggerLinkId, path });
    });

    args.setSearchLog(prev => [...prev, `[DONE] Found ${paths.length} path(s).`].slice(-8));
  } catch (err: any) {
    args.setError(err.message || 'Error during pathfinding');
    args.setSearchLog(prev => [...prev, `[ERROR] ${err.message}`].slice(-8));
  } finally {
    args.setLoading(false);
    args.setSearchProgress(prev => ({ ...prev, isSearching: false, isPaused: false }));
  }
}
