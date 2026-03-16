import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRANCH_SPREAD,
  DEFAULT_SHOW_CROSS_LINKS,
  DEFAULT_TREE_SPACING,
  getDefaultLayoutMode,
} from './layoutConfig';

describe('layoutConfig', () => {
  it('defaults to forest in development', () => {
    expect(getDefaultLayoutMode(true)).toBe('forest');
  });

  it('defaults to web outside development', () => {
    expect(getDefaultLayoutMode(false)).toBe('web');
  });

  it('exposes stable defaults for forest tuning', () => {
    expect(DEFAULT_TREE_SPACING).toBeGreaterThan(100);
    expect(DEFAULT_BRANCH_SPREAD).toBeGreaterThan(80);
    expect(DEFAULT_SHOW_CROSS_LINKS).toBe(true);
  });
});
