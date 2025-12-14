export type SearchProgress = {
  isSearching: boolean;
  currentDepth: number;
  maxDepth: number;
  currentPage: string;
  exploredCount: number;
  queueSize: number;
  exploredNodes: Set<string>;
};

