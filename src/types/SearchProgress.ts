export type SearchProgress = {
  isSearching: boolean;
  isPaused: boolean;
  keepSearching: boolean;
  currentDepth: number;
  maxDepth: number;
  currentPage: string;
  exploredCount: number;
  queueSize: number;
  exploredNodes: Set<string>;
};
