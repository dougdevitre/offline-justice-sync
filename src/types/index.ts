/**
 * @module @justice-os/offline-sync/types
 * @description Core type definitions for the Offline Justice Sync Engine.
 * Covers local storage, sync, conflict resolution, connection monitoring,
 * and SMS fallback.
 */

/** Supported local database backends */
export type DatabaseBackend = 'indexeddb' | 'sqlite';

/** Operation types in the sync queue */
export type OperationType = 'put' | 'delete' | 'patch';

/** Sync status for a document */
export type SyncStatus = 'synced' | 'pending' | 'conflict';

/** Connection quality status */
export type ConnectionStatus = 'online' | 'offline' | 'degraded';

/** Conflict resolution strategy */
export type ConflictStrategy = 'last-write-wins' | 'field-merge' | 'custom';

/** SMS message types */
export type SMSMessageType = 'deadline' | 'hearing' | 'critical';

/** SMS delivery status */
export type SMSDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';

/**
 * Configuration for the LocalStore
 */
export interface LocalStoreConfig {
  /** Database backend to use */
  database: DatabaseBackend;
  /** Database name */
  name: string;
  /** Schema version for migrations */
  version?: number;
  /** SQLite file path (for sqlite backend) */
  dbPath?: string;
}

/**
 * A document stored in the local database
 */
export interface LocalDocument<T = Record<string, unknown>> {
  /** Document ID */
  id: string;
  /** Collection/table name */
  collection: string;
  /** Document data */
  data: T;
  /** CRDT version vector */
  version: VectorClock;
  /** Whether this document has unsynced changes */
  dirty: boolean;
  /** Whether this document is soft-deleted */
  deleted: boolean;
  /** Last local modification time */
  localUpdatedAt: Date;
  /** Last remote sync time */
  remoteUpdatedAt: Date | null;
  /** Current sync status */
  syncStatus: SyncStatus;
}

/**
 * CRDT vector clock for conflict-free versioning
 */
export interface VectorClock {
  /** Node ID to counter mapping */
  counters: Record<string, number>;
}

/**
 * An operation in the sync queue
 */
export interface QueuedOperation {
  /** Operation ID */
  id: string;
  /** Target document ID */
  documentId: string;
  /** Target collection */
  collection: string;
  /** Operation type */
  type: OperationType;
  /** Operation payload */
  payload: Record<string, unknown>;
  /** Number of retry attempts */
  retryCount: number;
  /** When this operation was created */
  createdAt: Date;
  /** When to next attempt this operation */
  scheduledAt: Date;
  /** Current status */
  status: 'pending' | 'processing' | 'failed' | 'synced';
}

/**
 * Configuration for the SyncEngine
 */
export interface SyncEngineConfig {
  /** Local store instance */
  localStore: LocalStoreInstance;
  /** Remote sync server URL */
  remoteUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Sync interval in ms (when online) */
  syncIntervalMs?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Conflict resolution strategy */
  conflictStrategy?: ConflictStrategy;
  /** Custom conflict resolver function */
  customResolver?: (local: unknown, remote: unknown) => unknown;
  /** Node ID for CRDT */
  nodeId?: string;
}

/**
 * Interface for the local store (used by SyncEngine)
 */
export interface LocalStoreInstance {
  get<T>(collection: string, id: string): Promise<LocalDocument<T> | null>;
  put<T>(collection: string, data: T & { id: string }): Promise<LocalDocument<T>>;
  delete(collection: string, id: string): Promise<void>;
  query<T>(collection: string, filter?: QueryFilter): Promise<LocalDocument<T>[]>;
  getChangedSince(since: Date): Promise<QueuedOperation[]>;
}

/**
 * Query filter for local database queries
 */
export interface QueryFilter {
  /** Field to filter on */
  field: string;
  /** Comparison operator */
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';
  /** Value to compare against */
  value: unknown;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Number of operations sent to server */
  pushed: number;
  /** Number of changes received from server */
  pulled: number;
  /** Number of conflicts detected */
  conflicts: number;
  /** Number of conflicts auto-resolved */
  autoResolved: number;
  /** Conflicts requiring manual resolution */
  manualConflicts: ConflictRecord[];
  /** Duration of sync in ms */
  durationMs: number;
  /** Errors encountered */
  errors: string[];
}

/**
 * A detected conflict between local and remote versions
 */
export interface ConflictRecord {
  /** Conflict ID */
  id: string;
  /** Document ID */
  documentId: string;
  /** Collection */
  collection: string;
  /** Local version of the document */
  localVersion: Record<string, unknown>;
  /** Remote version of the document */
  remoteVersion: Record<string, unknown>;
  /** Merged version (if auto-resolved) */
  mergedVersion?: Record<string, unknown>;
  /** How this conflict was resolved */
  resolution: 'auto' | 'manual' | 'pending';
  /** Strategy used */
  strategy: ConflictStrategy;
  /** When the conflict was detected */
  detectedAt: Date;
  /** When the conflict was resolved (if resolved) */
  resolvedAt?: Date;
}

/**
 * Connection quality measurement
 */
export interface ConnectionQuality {
  /** Whether the device is online */
  online: boolean;
  /** Overall status */
  status: ConnectionStatus;
  /** Quality score 0-100 */
  quality: number;
  /** Latency in ms */
  latencyMs: number;
  /** Estimated bandwidth in kbps */
  bandwidthKbps: number;
  /** Timestamp of measurement */
  measuredAt: Date;
}

/**
 * Configuration for the ConnectionMonitor
 */
export interface ConnectionMonitorConfig {
  /** How often to check connection (ms) */
  checkIntervalMs?: number;
  /** URL to ping for connectivity checks */
  pingUrl?: string;
  /** Quality threshold for 'degraded' status (0-100) */
  degradedThreshold?: number;
}

/**
 * Configuration for SMS fallback
 */
export interface SMSGatewayConfig {
  /** Twilio account SID */
  accountSid: string;
  /** Twilio auth token */
  authToken: string;
  /** Twilio phone number to send from */
  fromNumber: string;
}

/**
 * An SMS message record
 */
export interface SMSMessage {
  /** Message ID */
  id: string;
  /** Recipient phone number */
  recipientPhone: string;
  /** Message content */
  content: string;
  /** Message type */
  type: SMSMessageType;
  /** Twilio message SID */
  twilioSid?: string;
  /** Delivery status */
  deliveryStatus: SMSDeliveryStatus;
  /** When the message was sent */
  sentAt: Date;
  /** When the message was delivered */
  deliveredAt?: Date;
}

/**
 * Event types emitted by various components
 */
export interface SyncEvents {
  'sync:start': void;
  'sync:complete': SyncResult;
  'sync:error': Error;
  'conflict:detected': ConflictRecord;
  'conflict:resolved': ConflictRecord;
  'online': ConnectionQuality;
  'offline': void;
  'degraded': ConnectionQuality;
}
