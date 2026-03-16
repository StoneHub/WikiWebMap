import { describe, expect, it } from 'vitest';
import { collectBranchNodeIds, computeForestLayout } from './forestLayout';

describe('forestLayout', () => {
  it('builds primary-child branches and returns descendants in branch order', () => {
    const metadataById = new Map([
      ['Root', { treeId: 'Root', layoutDepth: 0 }],
      ['Branch A', { primaryParentId: 'Root', treeId: 'Root', layoutDepth: 1 }],
      ['Leaf', { primaryParentId: 'Branch A', treeId: 'Root', layoutDepth: 2 }],
    ]);

    const result = computeForestLayout({
      nodes: [
        { id: 'Root' },
        { id: 'Branch A' },
        { id: 'Leaf' },
      ],
      metadataById,
      width: 1200,
      height: 800,
      treeSpacing: 180,
      branchSpread: 150,
    });

    expect(collectBranchNodeIds('Root', result.childrenByParent)).toEqual([
      'Root',
      'Branch A',
      'Leaf',
    ]);
    expect(result.hiddenNodeIds.size).toBe(0);
    expect(result.targets.has('Root')).toBe(true);
    expect(result.targets.has('Branch A')).toBe(true);
    expect(result.targets.has('Leaf')).toBe(true);
  });

  it('hides descendants of collapsed branches while leaving the collapsed node visible', () => {
    const metadataById = new Map([
      ['Root', { treeId: 'Root', layoutDepth: 0 }],
      ['Branch A', { primaryParentId: 'Root', treeId: 'Root', layoutDepth: 1, isCollapsed: true }],
      ['Leaf', { primaryParentId: 'Branch A', treeId: 'Root', layoutDepth: 2 }],
      ['Other Root', { treeId: 'Other Root', layoutDepth: 0 }],
    ]);

    const result = computeForestLayout({
      nodes: [
        { id: 'Root' },
        { id: 'Branch A' },
        { id: 'Leaf' },
        { id: 'Other Root' },
      ],
      metadataById,
      width: 1200,
      height: 800,
      treeSpacing: 180,
      branchSpread: 150,
    });

    expect(result.hiddenNodeIds.has('Branch A')).toBe(false);
    expect(result.hiddenNodeIds.has('Leaf')).toBe(true);
    expect(result.targets.has('Branch A')).toBe(true);
    expect(result.targets.has('Leaf')).toBe(false);
    expect(result.treeIds).toEqual(['Other Root', 'Root']);
  });

  it('places structured mode roots into stacked lanes with children to the right', () => {
    const metadataById = new Map([
      ['Alpha', { treeId: 'Alpha', layoutDepth: 0 }],
      ['Alpha Branch', { primaryParentId: 'Alpha', treeId: 'Alpha', layoutDepth: 1 }],
      ['Beta', { treeId: 'Beta', layoutDepth: 0 }],
    ]);

    const result = computeForestLayout({
      nodes: [
        { id: 'Alpha' },
        { id: 'Alpha Branch' },
        { id: 'Beta' },
      ],
      metadataById,
      width: 1400,
      height: 900,
      treeSpacing: 180,
      branchSpread: 150,
      layoutMode: 'structured',
    });

    expect(result.targets.get('Alpha Branch')!.x).toBeGreaterThan(result.targets.get('Alpha')!.x);
    expect(result.targets.get('Beta')!.y).toBeGreaterThan(result.targets.get('Alpha')!.y);
  });
});
