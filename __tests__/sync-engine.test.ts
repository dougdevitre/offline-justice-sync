/**
 * @tests SyncEngine
 * @description Tests for the sync engine.
 */

import { SyncEngine } from '../src/sync/sync-engine';
import { LocalStore } from '../src/database/local-store';

describe('SyncEngine', () => {
  let store: LocalStore;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    store = new LocalStore({ database: 'indexeddb', name: 'sync-test' });
    await store.initialize();

    syncEngine = new SyncEngine({
      localStore: store,
      remoteUrl: 'https://api.justice-os.org/sync',
      conflictStrategy: 'last-write-wins',
    });
  });

  describe('syncAll()', () => {
    it('should return a sync result', async () => {
      const result = await syncEngine.syncAll();

      expect(result).toBeDefined();
      expect(result.pushed).toBeGreaterThanOrEqual(0);
      expect(result.pulled).toBeGreaterThanOrEqual(0);
      expect(result.conflicts).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should push pending operations', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test' });
      await store.put('cases', { id: 'case-2', title: 'Test 2' });

      const result = await syncEngine.syncAll();

      expect(result.pushed).toBeGreaterThan(0);
    });

    it('should not overlap concurrent syncs', async () => {
      const sync1 = syncEngine.syncAll();
      const sync2 = syncEngine.syncAll();

      const [result1, result2] = await Promise.all([sync1, sync2]);

      // The second sync should report as skipped
      expect(result2.errors).toContain('Sync already in progress');
    });

    it('should update the last sync time', async () => {
      expect(syncEngine.getLastSyncTime()).toBeNull();

      await syncEngine.syncAll();

      expect(syncEngine.getLastSyncTime()).toBeInstanceOf(Date);
    });
  });

  describe('event emitting', () => {
    it('should emit sync:start event', async () => {
      const startHandler = jest.fn();
      syncEngine.on('sync:start', startHandler);

      await syncEngine.syncAll();

      expect(startHandler).toHaveBeenCalled();
    });

    it('should emit sync:complete event with result', async () => {
      const completeHandler = jest.fn();
      syncEngine.on('sync:complete', completeHandler);

      await syncEngine.syncAll();

      expect(completeHandler).toHaveBeenCalledWith(expect.objectContaining({
        pushed: expect.any(Number),
        pulled: expect.any(Number),
        durationMs: expect.any(Number),
      }));
    });
  });

  describe('isSyncing()', () => {
    it('should report false when not syncing', () => {
      expect(syncEngine.isSyncing()).toBe(false);
    });
  });

  describe('auto sync', () => {
    it('should return an interval ID', () => {
      const intervalId = syncEngine.startAutoSync();
      expect(intervalId).toBeDefined();
      clearInterval(intervalId);
    });
  });
});
