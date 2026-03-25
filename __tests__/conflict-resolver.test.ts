/**
 * @tests ConflictResolver
 * @description Tests for the CRDT-based conflict resolution system.
 */

import { ConflictResolver } from '../src/sync/conflict-resolver';
import type { VectorClock } from '../src/types';

describe('ConflictResolver', () => {
  describe('last-write-wins strategy', () => {
    let resolver: ConflictResolver;

    beforeEach(() => {
      resolver = new ConflictResolver('last-write-wins');
    });

    it('should pick the more recent document', () => {
      const local = { id: '1', title: 'Local Version', updatedAt: '2026-03-25T10:00:00Z' };
      const remote = { id: '1', title: 'Remote Version', updatedAt: '2026-03-25T09:00:00Z' };

      const result = resolver.resolve(local, remote);

      expect(result.merged.title).toBe('Local Version');
      expect(result.resolution).toBe('auto');
      expect(result.strategy).toBe('last-write-wins');
    });

    it('should pick remote when it is more recent', () => {
      const local = { id: '1', title: 'Local', updatedAt: '2026-03-25T09:00:00Z' };
      const remote = { id: '1', title: 'Remote', updatedAt: '2026-03-25T10:00:00Z' };

      const result = resolver.resolve(local, remote);

      expect(result.merged.title).toBe('Remote');
    });

    it('should auto-resolve all conflicts', () => {
      const result = resolver.resolve({ a: 1 }, { a: 2 });

      expect(result.resolution).toBe('auto');
    });
  });

  describe('field-merge strategy', () => {
    let resolver: ConflictResolver;

    beforeEach(() => {
      resolver = new ConflictResolver('field-merge');
    });

    it('should merge non-conflicting fields', () => {
      const local = { id: '1', title: 'Shared', localField: 'local-only' };
      const remote = { id: '1', title: 'Shared', remoteField: 'remote-only' };

      const result = resolver.resolve(local, remote);

      expect(result.merged.title).toBe('Shared');
      expect(result.merged.localField).toBe('local-only');
      expect(result.merged.remoteField).toBe('remote-only');
      expect(result.resolution).toBe('auto');
    });

    it('should flag conflicting fields for manual resolution', () => {
      const local = { id: '1', title: 'Local Title', status: 'active' };
      const remote = { id: '1', title: 'Remote Title', status: 'active' };

      const result = resolver.resolve(local, remote);

      expect(result.merged.title).toBe('Local Title'); // local kept
      expect(result.merged['_conflict_title']).toBe('Remote Title'); // remote stored
      expect(result.resolution).toBe('manual');
    });

    it('should handle fields only in one version', () => {
      const local = { id: '1', title: 'Test' };
      const remote = { id: '1', title: 'Test', newField: 'new-value' };

      const result = resolver.resolve(local, remote);

      expect(result.merged.newField).toBe('new-value');
      expect(result.resolution).toBe('auto');
    });

    it('should not flag identical fields as conflicts', () => {
      const local = { id: '1', title: 'Same', status: 'active' };
      const remote = { id: '1', title: 'Same', status: 'active' };

      const result = resolver.resolve(local, remote);

      expect(result.resolution).toBe('auto');
      expect(result.merged.title).toBe('Same');
    });
  });

  describe('custom strategy', () => {
    it('should use the custom resolver function', () => {
      const customResolver = (local: unknown, remote: unknown) => {
        const l = local as Record<string, unknown>;
        const r = remote as Record<string, unknown>;
        return { ...l, ...r, mergedBy: 'custom' };
      };

      const resolver = new ConflictResolver('custom', customResolver);
      const result = resolver.resolve({ a: 1 }, { b: 2 });

      expect(result.merged.a).toBe(1);
      expect(result.merged.b).toBe(2);
      expect(result.merged.mergedBy).toBe('custom');
      expect(result.strategy).toBe('custom');
    });

    it('should fall back to last-write-wins if no custom resolver', () => {
      const resolver = new ConflictResolver('custom');
      const result = resolver.resolve(
        { updatedAt: '2026-03-25T10:00:00Z' },
        { updatedAt: '2026-03-25T09:00:00Z' }
      );

      expect(result.strategy).toBe('last-write-wins');
    });
  });

  describe('compareClocks()', () => {
    let resolver: ConflictResolver;

    beforeEach(() => {
      resolver = new ConflictResolver();
    });

    it('should detect "before" ordering', () => {
      const a: VectorClock = { counters: { node1: 1, node2: 1 } };
      const b: VectorClock = { counters: { node1: 2, node2: 2 } };

      expect(resolver.compareClocks(a, b)).toBe('before');
    });

    it('should detect "after" ordering', () => {
      const a: VectorClock = { counters: { node1: 3, node2: 3 } };
      const b: VectorClock = { counters: { node1: 1, node2: 1 } };

      expect(resolver.compareClocks(a, b)).toBe('after');
    });

    it('should detect "concurrent" modifications', () => {
      const a: VectorClock = { counters: { node1: 2, node2: 1 } };
      const b: VectorClock = { counters: { node1: 1, node2: 2 } };

      expect(resolver.compareClocks(a, b)).toBe('concurrent');
    });

    it('should handle clocks with different node sets', () => {
      const a: VectorClock = { counters: { node1: 1 } };
      const b: VectorClock = { counters: { node2: 1 } };

      expect(resolver.compareClocks(a, b)).toBe('concurrent');
    });
  });
});
