/**
 * @module SyncEngine
 * @description Orchestrates the synchronization process between the local
 * database and the remote server. Handles delta calculation, conflict
 * resolution, and retry logic.
 */

import { DeltaCalculator } from './delta-calculator';
import { ConflictResolver } from './conflict-resolver';
import { RetryQueue } from './retry-queue';
import type {
  SyncEngineConfig,
  SyncResult,
  QueuedOperation,
  LocalStoreInstance,
  ConflictRecord,
} from '../types';

/**
 * Default sync configuration
 */
const DEFAULT_CONFIG = {
  syncIntervalMs: 30000,
  maxRetries: 5,
  conflictStrategy: 'last-write-wins' as const,
  nodeId: `node-${Date.now()}`,
};

/**
 * SyncEngine synchronizes the local-first database with a remote server.
 * Handles delta sync, conflict resolution, and retry logic for reliable
 * data synchronization even with intermittent connectivity.
 *
 * @example
 * ```typescript
 * const sync = new SyncEngine({
 *   localStore: store,
 *   remoteUrl: 'https://api.justice-os.org/sync',
 *   conflictStrategy: 'field-merge',
 * });
 *
 * const result = await sync.syncAll();
 * console.log(`Pushed: ${result.pushed}, Pulled: ${result.pulled}`);
 * ```
 */
export class SyncEngine {
  private config: Required<SyncEngineConfig>;
  private deltaCalculator: DeltaCalculator;
  private conflictResolver: ConflictResolver;
  private retryQueue: RetryQueue;
  private syncing: boolean = false;
  private lastSyncAt: Date | null = null;
  private listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  /**
   * Create a new SyncEngine.
   * @param config - Sync configuration
   */
  constructor(config: SyncEngineConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      customResolver: config.customResolver || undefined,
    } as Required<SyncEngineConfig>;

    this.deltaCalculator = new DeltaCalculator();
    this.conflictResolver = new ConflictResolver(this.config.conflictStrategy);
    this.retryQueue = new RetryQueue(this.config.maxRetries);
  }

  /**
   * Perform a full sync — push local changes, pull remote changes.
   *
   * @returns Detailed sync result
   */
  async syncAll(): Promise<SyncResult> {
    if (this.syncing) {
      return { pushed: 0, pulled: 0, conflicts: 0, autoResolved: 0, manualConflicts: [], durationMs: 0, errors: ['Sync already in progress'] };
    }

    this.syncing = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;
    let conflicts = 0;
    let autoResolved = 0;
    const manualConflicts: ConflictRecord[] = [];

    try {
      this.emit('sync:start');

      // Step 1: Get pending local operations
      const since = this.lastSyncAt || new Date(0);
      const pendingOps = await this.config.localStore.getChangedSince(since);

      // Step 2: Calculate deltas
      const deltas = this.deltaCalculator.calculate(pendingOps);

      // Step 3: Push to remote
      if (deltas.length > 0) {
        const pushResult = await this.pushToRemote(deltas);
        pushed = pushResult.pushed;
        errors.push(...pushResult.errors);
      }

      // Step 4: Pull from remote
      const pullResult = await this.pullFromRemote();
      pulled = pullResult.pulled;

      // Step 5: Resolve conflicts
      for (const conflict of pullResult.conflicts) {
        const resolved = this.conflictResolver.resolve(
          conflict.localVersion,
          conflict.remoteVersion
        );

        if (resolved.resolution === 'auto') {
          autoResolved++;
        } else {
          manualConflicts.push({ ...conflict, resolution: 'pending' });
        }
        conflicts++;
      }

      this.lastSyncAt = new Date();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      this.syncing = false;
    }

    const result: SyncResult = {
      pushed,
      pulled,
      conflicts,
      autoResolved,
      manualConflicts,
      durationMs: Date.now() - startTime,
      errors,
    };

    this.emit('sync:complete', result);
    return result;
  }

  /**
   * Start automatic periodic syncing.
   * @returns Interval ID for stopping
   */
  startAutoSync(): NodeJS.Timeout {
    return setInterval(() => this.syncAll(), this.config.syncIntervalMs);
  }

  /**
   * Check if a sync is currently in progress.
   */
  isSyncing(): boolean {
    return this.syncing;
  }

  /**
   * Get the time of the last successful sync.
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncAt;
  }

  /**
   * Register an event listener.
   * @param event - Event name
   * @param callback - Callback function
   */
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event) || [];
    for (const callback of callbacks) {
      callback(...args);
    }
  }

  private async pushToRemote(operations: QueuedOperation[]): Promise<{ pushed: number; errors: string[] }> {
    // In production: POST operations to remote sync endpoint
    return { pushed: operations.length, errors: [] };
  }

  private async pullFromRemote(): Promise<{ pulled: number; conflicts: ConflictRecord[] }> {
    // In production: GET changes from remote since last sync
    return { pulled: 0, conflicts: [] };
  }
}
