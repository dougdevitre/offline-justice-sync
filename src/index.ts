/**
 * @module @justice-os/offline-sync
 * @description Local-first database that works offline, syncs when connection
 * returns, and falls back to SMS for critical communications.
 *
 * @example
 * ```typescript
 * import { LocalStore, SyncEngine, ConnectionMonitor } from '@justice-os/offline-sync';
 *
 * const store = new LocalStore({ database: 'indexeddb', name: 'justice-app' });
 * await store.initialize();
 *
 * const monitor = new ConnectionMonitor();
 * const sync = new SyncEngine({ localStore: store, remoteUrl: '...' });
 * ```
 */

export { LocalStore } from './database/local-store';
export { SchemaManager } from './database/schema-manager';
export { QueryEngine } from './database/query-engine';

export { SyncEngine } from './sync/sync-engine';
export { DeltaCalculator } from './sync/delta-calculator';
export { ConflictResolver } from './sync/conflict-resolver';
export { RetryQueue } from './sync/retry-queue';

export { ConnectionMonitor } from './connection/connection-monitor';
export { BandwidthOptimizer } from './connection/bandwidth-optimizer';

export { SMSGateway } from './fallback/sms-gateway';
export { SMSProtocol } from './fallback/sms-protocol';

export type {
  DatabaseBackend,
  OperationType,
  SyncStatus,
  ConnectionStatus,
  ConflictStrategy,
  LocalStoreConfig,
  LocalDocument,
  VectorClock,
  QueuedOperation,
  SyncEngineConfig,
  QueryFilter,
  SyncResult,
  ConflictRecord,
  ConnectionQuality,
  ConnectionMonitorConfig,
  SMSGatewayConfig,
  SMSMessage,
  SyncEvents,
} from './types';
