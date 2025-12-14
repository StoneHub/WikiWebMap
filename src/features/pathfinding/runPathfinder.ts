import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { GraphManager, Link, Node } from '../../GraphManager';
import { WikiService } from '../../WikiService';
import type { SearchProgress } from '../../types/SearchProgress';

export async function runPathfinder(args: {
  startInput: string;
  endInput: string;
  graphManagerRef: MutableRefObject<GraphManager | null>;
  searchAbortRef: MutableRefObject<boolean>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSearchLog: Dispatch<SetStateAction<string[]>>;
  setSearchProgress: Dispatch<SetStateAction<SearchProgress>>;
  setPathNodes: Dispatch<SetStateAction<Set<string>>>;
  setError: Dispatch<SetStateAction<string>>;
  setPathSelectedNodes: Dispatch<SetStateAction<Node[]>>;
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
    currentDepth: 0,
    maxDepth: 6,
    exploredCount: 0,
    currentPage: startTitle,
    queueSize: 1,
    exploredNodes: new Set([startTitle]),
  });
  args.setPathNodes(new Set());
  args.setError('');
  args.searchAbortRef.current = false;

  const queue: { title: string; depth: number }[] = [{ title: startTitle, depth: 0 }];
  const visited = new Set<string>([startTitle]);
  const parentMap = new Map<string, string>();
  let nodesExplored = 0;

  try {
    while (queue.length > 0) {
      if (args.searchAbortRef.current) break;
      const { title, depth } = queue.shift()!;

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
        }));
        await new Promise(r => setTimeout(r, 0));
      }

      if (depth >= 6) continue;
      if (nodesExplored > 500) throw new Error(`Exceeded exploration limit (500 nodes).`);

      const links = await WikiService.fetchLinks(title);

      for (const linkObj of links) {
        const link = linkObj.title;
        if (visited.has(link)) continue;

        if (link === endTitle) {
          args.setSearchLog(prev => [...prev, `>> TARGET ACQUIRED: ${link} <<`]);
          parentMap.set(link, title);
          const path: string[] = [endTitle];
          let curr = endTitle;
          while (curr !== startTitle) {
            const p = parentMap.get(curr)!;
            path.unshift(p);
            curr = p;
          }

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
            args.setPathNodes(new Set(path));

            const updates = path.map(p => ({ nodeId: p, metadata: { isInPath: true } }));
            args.graphManagerRef.current.setNodesMetadata(updates);
            args.graphManagerRef.current.highlightNode(null);
          }

          args.setPathSelectedNodes([]);
          args.setSearchProgress(prev => ({ ...prev, isSearching: false }));
          args.setLoading(false);
          return;
        }

        visited.add(link);
        parentMap.set(link, title);
        queue.push({ title: link, depth: depth + 1 });
      }
    }

    if (!args.searchAbortRef.current) {
      args.setError('No path found within search limits.');
      args.setSearchLog(prev => [...prev, `[FAILURE] Target not found in search horizon.`]);
    }
  } catch (err: any) {
    args.setError(err.message || 'Error during pathfinding');
    args.setSearchLog(prev => [...prev, `[ERROR] ${err.message}`]);
  } finally {
    args.setLoading(false);
    args.setSearchProgress(prev => ({ ...prev, isSearching: false }));
  }
}

