import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { GraphManager } from '../../GraphManager';
import type { SearchProgress } from '../../types/SearchProgress';

export async function runAutoTest(args: {
  graphManagerRef: MutableRefObject<GraphManager | null>;
  addTopic: (title: string, silent?: boolean) => Promise<string | undefined>;
  findPath: (startInput: string, endInput: string) => Promise<void>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  setSearchLog: Dispatch<SetStateAction<string[]>>;
  setSearchProgress: Dispatch<SetStateAction<SearchProgress>>;
  setError: Dispatch<SetStateAction<string>>;
}) {
  args.setShowSettings(false);

  if (args.graphManagerRef.current) args.graphManagerRef.current.clear();

  args.setSearchTerm('Auto-Test Running...');
  args.setSearchLog(['[TEST] 🧪 Starting Protocol verify_fix_1...']);
  args.setSearchProgress(prev => ({ ...prev, isSearching: true, exploredCount: 0 }));

  try {
    args.setSearchLog(prev => [...prev, '[TEST] Seeding start node: "Physics"...']);
    args.setSearchTerm('Adding: Physics');
    const startTitle = await args.addTopic('Physics', true);

    args.setSearchLog(prev => [...prev, '[TEST] Seeding target node: "Science"...']);
    args.setSearchTerm('Adding: Science');
    const endTitle = await args.addTopic('Science', true);

    if (!startTitle || !endTitle) throw new Error('Failed to seed nodes (API Error?)');

    args.setSearchLog(prev => [...prev, `[TEST] Nodes seeded. Resolved: "${startTitle}" & "${endTitle}"`]);
    args.setSearchTerm('Waiting for graph...');

    let attempts = 0;
    const checkGraph = setInterval(() => {
      attempts++;
      const hasNodes = args.graphManagerRef.current?.getStats().nodeCount || 0;

      if (hasNodes >= 2) {
        clearInterval(checkGraph);
        args.setSearchLog(prev => [...prev, '[TEST] Graph ready. Launching Pathfinder...']);
        args.setSearchTerm(`Searching: ${startTitle} -> ${endTitle}`);
        void args.findPath(startTitle, endTitle);
      } else if (attempts > 50) {
        clearInterval(checkGraph);
        args.setSearchLog(prev => [...prev, '[TEST] ❌ Timed out waiting for nodes.']);
        args.setError('Auto-Test Timeout: Nodes did not appear.');
        args.setSearchProgress(prev => ({ ...prev, isSearching: false }));
      }
    }, 200);
  } catch (e: any) {
    args.setSearchLog(prev => [...prev, `[TEST] ❌ Error: ${e.message}`]);
    args.setError(`Auto-Test Error: ${e.message}`);
    args.setSearchProgress(prev => ({ ...prev, isSearching: false }));
  }
}
