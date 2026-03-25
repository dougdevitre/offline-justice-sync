/**
 * @tests LocalStore
 * @description Tests for the local-first database.
 */

import { LocalStore } from '../src/database/local-store';

describe('LocalStore', () => {
  let store: LocalStore;

  beforeEach(async () => {
    store = new LocalStore({ database: 'indexeddb', name: 'test-db' });
    await store.initialize();
  });

  describe('initialize()', () => {
    it('should initialize successfully', async () => {
      const newStore = new LocalStore({ database: 'indexeddb', name: 'init-test' });
      await expect(newStore.initialize()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await expect(store.initialize()).resolves.not.toThrow();
    });
  });

  describe('put()', () => {
    it('should store a document', async () => {
      const doc = await store.put('cases', { id: 'case-1', title: 'Test Case' });

      expect(doc.id).toBe('case-1');
      expect(doc.collection).toBe('cases');
      expect(doc.data.title).toBe('Test Case');
      expect(doc.dirty).toBe(true);
      expect(doc.syncStatus).toBe('pending');
    });

    it('should assign a version vector', async () => {
      const doc = await store.put('cases', { id: 'case-1', title: 'Test' });

      expect(doc.version).toBeDefined();
      expect(doc.version.counters).toBeDefined();
      expect(Object.keys(doc.version.counters).length).toBe(1);
    });

    it('should increment version on update', async () => {
      const doc1 = await store.put('cases', { id: 'case-1', title: 'V1' });
      const doc2 = await store.put('cases', { id: 'case-1', title: 'V2' });

      const nodeId = Object.keys(doc1.version.counters)[0];
      expect(doc2.version.counters[nodeId]).toBeGreaterThan(doc1.version.counters[nodeId]);
    });

    it('should enqueue a sync operation', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test' });

      const pending = await store.getPendingCount();
      expect(pending).toBe(1);
    });
  });

  describe('get()', () => {
    it('should retrieve a stored document', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test Case' });

      const doc = await store.get('cases', 'case-1');

      expect(doc).not.toBeNull();
      expect(doc!.data.title).toBe('Test Case');
    });

    it('should return null for non-existent documents', async () => {
      const doc = await store.get('cases', 'nonexistent');

      expect(doc).toBeNull();
    });

    it('should return null for deleted documents', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test' });
      await store.delete('cases', 'case-1');

      const doc = await store.get('cases', 'case-1');
      expect(doc).toBeNull();
    });

    it('should return null for non-existent collections', async () => {
      const doc = await store.get('nonexistent', 'id-1');
      expect(doc).toBeNull();
    });
  });

  describe('delete()', () => {
    it('should soft-delete a document', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test' });
      await store.delete('cases', 'case-1');

      const doc = await store.get('cases', 'case-1');
      expect(doc).toBeNull();
    });

    it('should enqueue a delete operation', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test' });
      await store.delete('cases', 'case-1');

      const pending = await store.getPendingCount();
      expect(pending).toBe(2); // put + delete
    });

    it('should handle deleting non-existent documents gracefully', async () => {
      await expect(store.delete('cases', 'nonexistent')).resolves.not.toThrow();
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      await store.put('cases', { id: 'case-1', title: 'Housing', status: 'active' });
      await store.put('cases', { id: 'case-2', title: 'Employment', status: 'closed' });
      await store.put('cases', { id: 'case-3', title: 'Family', status: 'active' });
    });

    it('should return all documents without a filter', async () => {
      const docs = await store.query('cases');
      expect(docs).toHaveLength(3);
    });

    it('should filter by equality', async () => {
      const docs = await store.query('cases', {
        field: 'status',
        operator: '=',
        value: 'active',
      });
      expect(docs).toHaveLength(2);
    });

    it('should filter by inequality', async () => {
      const docs = await store.query('cases', {
        field: 'status',
        operator: '!=',
        value: 'active',
      });
      expect(docs).toHaveLength(1);
    });

    it('should filter by contains', async () => {
      const docs = await store.query('cases', {
        field: 'title',
        operator: 'contains',
        value: 'Hous',
      });
      expect(docs).toHaveLength(1);
    });

    it('should return empty array for non-existent collections', async () => {
      const docs = await store.query('nonexistent');
      expect(docs).toHaveLength(0);
    });
  });

  describe('operation queue', () => {
    it('should track pending operations', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test' });
      await store.put('cases', { id: 'case-2', title: 'Test 2' });

      const pending = await store.getPendingCount();
      expect(pending).toBe(2);
    });

    it('should mark operations as synced', async () => {
      await store.put('cases', { id: 'case-1', title: 'Test' });
      const ops = await store.getPendingOperations();

      await store.markSynced(ops.map((o) => o.id));

      const pending = await store.getPendingCount();
      expect(pending).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should throw if not initialized', async () => {
      const uninitStore = new LocalStore({ database: 'indexeddb', name: 'uninit' });

      await expect(uninitStore.put('cases', { id: '1', title: 'Test' }))
        .rejects.toThrow('not initialized');
    });
  });
});
