export type LayoutMode = 'web' | 'forest' | 'structured';

export const DEFAULT_TREE_SPACING = 180;
export const DEFAULT_BRANCH_SPREAD = 160;
export const DEFAULT_SHOW_CROSS_LINKS = true;

export const getDefaultLayoutMode = (isDevelopment: boolean): LayoutMode =>
  isDevelopment ? 'forest' : 'web';
