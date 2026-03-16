import { describe, expect, it } from 'vitest';
import type { GraphStateSnapshot } from '../../GraphManager';
import { computeStructuredLayout } from './structuredLayout';

describe('structuredLayout', () => {
  it('stacks multiple root trees into separate vertical lanes', () => {
    const snapshot: GraphStateSnapshot = {
      nodes: [
        { id: 'Alpha', title: 'Alpha' },
        { id: 'Alpha Child', title: 'Alpha Child' },
        { id: 'Beta', title: 'Beta' },
      ],
      links: [],
      nodeMetadata: {
        Alpha: { treeId: 'Alpha', layoutDepth: 0, isUserTyped: true, isAutoDiscovered: false, isExpanded: false, isInPath: false, isRecentlyAdded: false, isCurrentlyExploring: false, isSelected: false, isPathEndpoint: false, isBulkSelected: false, isDimmed: false, isDimmedByPath: false },
        'Alpha Child': { primaryParentId: 'Alpha', treeId: 'Alpha', layoutDepth: 1, isUserTyped: false, isAutoDiscovered: true, isExpanded: false, isInPath: false, isRecentlyAdded: false, isCurrentlyExploring: false, isSelected: false, isPathEndpoint: false, isBulkSelected: false, isDimmed: false, isDimmedByPath: false },
        Beta: { treeId: 'Beta', layoutDepth: 0, isUserTyped: true, isAutoDiscovered: false, isExpanded: false, isInPath: false, isRecentlyAdded: false, isCurrentlyExploring: false, isSelected: false, isPathEndpoint: false, isBulkSelected: false, isDimmed: false, isDimmedByPath: false },
      },
    };

    const result = computeStructuredLayout({
      snapshot,
      preferredRootOrder: ['Alpha', 'Beta'],
    });

    expect(result.rootIds).toEqual(['Alpha', 'Beta']);
    expect(result.positions.get('Alpha Child')!.x).toBeGreaterThan(result.positions.get('Alpha')!.x);
    expect(result.positions.get('Beta')!.y).toBeGreaterThan(result.positions.get('Alpha')!.y);
  });

  it('hides descendants of collapsed nodes while leaving the collapsed node visible', () => {
    const snapshot: GraphStateSnapshot = {
      nodes: [
        { id: 'Root', title: 'Root' },
        { id: 'Branch', title: 'Branch' },
        { id: 'Leaf', title: 'Leaf' },
      ],
      links: [],
      nodeMetadata: {
        Root: { treeId: 'Root', layoutDepth: 0, isUserTyped: true, isAutoDiscovered: false, isExpanded: false, isInPath: false, isRecentlyAdded: false, isCurrentlyExploring: false, isSelected: false, isPathEndpoint: false, isBulkSelected: false, isDimmed: false, isDimmedByPath: false },
        Branch: { primaryParentId: 'Root', treeId: 'Root', layoutDepth: 1, isCollapsed: true, isUserTyped: false, isAutoDiscovered: true, isExpanded: false, isInPath: false, isRecentlyAdded: false, isCurrentlyExploring: false, isSelected: false, isPathEndpoint: false, isBulkSelected: false, isDimmed: false, isDimmedByPath: false },
        Leaf: { primaryParentId: 'Branch', treeId: 'Root', layoutDepth: 2, isUserTyped: false, isAutoDiscovered: true, isExpanded: false, isInPath: false, isRecentlyAdded: false, isCurrentlyExploring: false, isSelected: false, isPathEndpoint: false, isBulkSelected: false, isDimmed: false, isDimmedByPath: false },
      },
    };

    const result = computeStructuredLayout({
      snapshot,
    });

    expect(result.hiddenNodeIds.has('Branch')).toBe(false);
    expect(result.hiddenNodeIds.has('Leaf')).toBe(true);
    expect(result.positions.has('Branch')).toBe(true);
    expect(result.positions.has('Leaf')).toBe(false);
  });
});
