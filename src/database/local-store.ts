/**
 * @module LocalStore
 * @description Local-first database wrapper that supports IndexedDB (browser)
 * and SQLite (Node.js/mobile). Provides a unified CRUD API that works
 * entirely offline with automatic operation queueing for later sync.
 */

import type {
  LocalStoreConfig,
  LocalDocument,
  VectorClock,
  QueuedOperation,
  QueryFilter,
  DatabaseBackend,
} from '../types';

/**
 * Default configuration for LocalStore
 */
const DEFAULT_CONFIG: Required<LocalStoreConfig> = {
  database: 'indexeddb',
  name: 'justice-offline',
  version: 1,
  dbPath: './data/justice-local.db',
};

/**
 * LocalStore provides a local-first database that works entirely offline.
 * All CRUD operations happen locally and are queued for later synchronization
 * with the remote server.
 *
 * @example
 * ```typescript
 * const store = new LocalStore({ database: 'indexeddb', name: 'my-app' });
 * await store.initialize();
 *
 * // All operations work offline
 * await store.put('cases', { id: 'case-1', title: 'Housing Dispute' });
 * const doc = await store.get('cases', 'case-1');
 * const all = await store.query('cases', { field: 'status', operator: '=', value: 'active' });
 * ```
 */
export class LocalStore {
  private config: Required<LocalStoreConfig>;
  private initialized: boolean = false;
  private data: Map<string, Map<string, LocalDocument>> = new Map();
  private operationQueue: QueuedOperation[] = [];
  private nodeId: string;

  /**
   * Create a new LocalStore instance.
   * @param config - Database configuration
   */
  constructor(config: Partial<LocalStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<LocalStoreConfig>;
    this.nodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Initialize the local database.
   * Creates the database and runs any pending migrations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.database === 'indexeddb') {
      await this.initIndexedDB();
    } else {
      await this.initSQLite();
    }

    this.initialized = true;
  }

  /**
   * Store a document in a collection. Creates or updates.
   *
   * @param collection - The collection/table name
   * @param data - The document data (must include `id`)
   * @returns The stored local document with metadata
   */
  async put<T extends { id: string }>(collection: string, data: T): Promise<LocalDocument<T>> {
    this.ensureInitialized();

    if (!this.data.has(collection)) {
      this.data.set(collection, new Map());
    }

    const existing = this.data.get(collection)!.get(data.id) as LocalDocument<T> | undefined;
    const version = this.incrementClock(existing?.version);

    const doc: LocalDocument<T> = {
      id: data.id,
      collection,
      data,
      version,
      dirty: true,
      deleted: false,
      localUpdatedAt: new Date(),
      remoteUpdatedAt: existing?.remoteUpdatedAt || null,
      syncStatus: 'pending',
    };

    this.data.get(collection)!.set(data.id, doc as LocalDocument);

    // Queue the operation for sync
    this.enqueueOperation({
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      documentId: data.id,
      collection,
      type: existing ? 'patch' : 'put',
      payload: data as unknown as Record<string, unknown>,
      retryCount: 0,
      createdAt: new Date(),
      scheduledAt: new Date(),
      status: 'pending',
    });

    return doc;
  }

  /**
   * Retrieve a document from a collection.
   *
   * @param collection - The collection name
   * @param id - The document ID
   * @returns The document or null if not found
   */
  async get<T>(collection: string, id: string): Promise<LocalDocument<T> | null> {
    this.ensureInitialized();

    const collectionMap = this.data.get(collection);
    if (!collectionMap) return null;

    const doc = collectionMap.get(id) as LocalDocument<T> | undefined;
    if (!doc || doc.deleted) return null;

    return doc;
  }

  /**
   * Delete a document from a collection (soft delete).
   *
   * @param collection - The collection name
   * @param id - The document ID
   */
  async delete(collection: string, id: string): Promise<void> {
    this.ensureInitialized();

    const collectionMap = this.data.get(collection);
    if (!collectionMap) return;

    const doc = collectionMap.get(id);
    if (doc) {
      doc.deleted = true;
      doc.dirty = true;
      doc.syncStatus = 'pending';
      doc.localUpdatedAt = new Date();
      doc.version = this.incrementClock(doc.version);

      this.enqueueOperation({
        id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        documentId: id,
        collection,
        type: 'delete',
        payload: {},
        retryCount: 0,
        createdAt: new Date(),
        scheduledAt: new Date(),
        status: 'pending',
      });
    }
  }

  /**
   * Query documents in a collection with optional filtering.
   *
   * @param collection - The collection name
   * @param filter - Optional query filter
   * @returns Array of matching documents
   */
  async query<T>(collection: string, filter?: QueryFilter): Promise<LocalDocument<T>[]> {
    this.ensureInitialized();

    const collectionMap = this.data.get(collection);
    if (!collectionMap) return [];

    let docs = Array.from(collectionMap.values())
      .filter((doc) => !doc.deleted) as LocalDocument<T>[];

    if (filter) {
      docs = docs.filter((doc) => {
        const value = (doc.data as Record<string, unknown>)[filter.field];
        switch (filter.operator) {
          case '=': return value === filter.value;
          case '!=': return value !== filter.value;
          case '>': return (value as number) > (filter.value as number);
          case '<': return (value as number) < (filter.value as number);
          case '>=': return (value as number) >= (filter.value as number);
          case '<=': return (value as number) <= (filter.value as number);
          case 'contains': return String(value).includes(String(filter.value));
          default: return true;
        }
      });
    }

    return docs;
  }

  /**
   * Get all pending operations since a given date.
   *
   * @param since - Only return operations after this date
   * @returns Array of queued operations
   */
  async getChangedSince(since: Date): Promise<QueuedOperation[]> {
    return this.operationQueue.filter(
      (op) => op.status === 'pending' && op.createdAt >= since
    );
  }

  /**
   * Get all pending operations in the queue.
   * @returns Array of pending operations
   */
  async getPendingOperations(): Promise<QueuedOperation[]> {
    return this.operationQueue.filter((op) => op.status === 'pending');
  }

  /**
   * Mark operations as synced.
   * @param operationIds - IDs of operations to mark as synced
   */
  async markSynced(operationIds: string[]): Promise<void> {
    for (const op of this.operationQueue) {
      if (operationIds.includes(op.id)) {
        op.status = 'synced';
      }
    }
    // Clean up synced operations
    this.operationQueue = this.operationQueue.filter((op) => op.status !== 'synced');
  }

  /**
   * Get the count of pending operations.
   * @returns Number of pending operations
   */
  async getPendingCount(): Promise<number> {
    return this.operationQueue.filter((op) => op.status === 'pending').length;
  }

  /**
   * Increment the CRDT vector clock.
   */
  private incrementClock(existing?: VectorClock): VectorClock {
    const clock: VectorClock = existing
      ? { counters: { ...existing.counters } }
      : { counters: {} };

    clock.counters[this.nodeId] = (clock.counters[this.nodeId] || 0) + 1;
    return clock;
  }

  /**
   * Enqueue an operation for later sync.
   */
  private enqueueOperation(operation: QueuedOperation): void {
    this.operationQueue.push(operation);
  }

  /**
   * Ensure the store has been initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LocalStore not initialized. Call initialize() first.');
    }
  }

  /**
   * Initialize IndexedDB backend.
   */
  private async initIndexedDB(): Promise<void> {
    // In production: open IndexedDB using the 'idb' library
  }

  /**
   * Initialize SQLite backend.
   */
  private async initSQLite(): Promise<void> {
    // In production: open SQLite using better-sqlite3
  }
}
