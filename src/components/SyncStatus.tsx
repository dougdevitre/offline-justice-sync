/**
 * @module SyncStatus
 * @description React component showing the current sync status —
 * last sync time, pending operations, and sync progress.
 */

import React from 'react';
import type { SyncResult, ConnectionStatus } from '../types';

/**
 * Props for the SyncStatus component
 */
export interface SyncStatusProps {
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Last sync result */
  lastSync: SyncResult | null;
  /** Number of pending operations */
  pendingCount: number;
  /** Whether a sync is currently in progress */
  syncing: boolean;
  /** Callback to trigger manual sync */
  onSync?: () => void;
  /** Custom CSS class name */
  className?: string;
}

/**
 * SyncStatus displays a compact sync status indicator with pending
 * operation count, last sync time, and a manual sync trigger.
 *
 * @example
 * ```tsx
 * <SyncStatus
 *   connectionStatus="online"
 *   lastSync={lastSyncResult}
 *   pendingCount={3}
 *   syncing={false}
 *   onSync={() => syncEngine.syncAll()}
 * />
 * ```
 */
export const SyncStatus: React.FC<SyncStatusProps> = ({
  connectionStatus,
  lastSync,
  pendingCount,
  syncing,
  onSync,
  className,
}) => {
  const statusColors: Record<ConnectionStatus, string> = {
    online: '#22c55e',
    offline: '#ef4444',
    degraded: '#f59e0b',
  };

  return (
    <div className={className} data-testid="sync-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: statusColors[connectionStatus],
          display: 'inline-block',
        }}
        aria-label={`Connection: ${connectionStatus}`}
      />

      <span>{connectionStatus === 'offline' ? 'Offline' : syncing ? 'Syncing...' : 'Online'}</span>

      {pendingCount > 0 && (
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          ({pendingCount} pending)
        </span>
      )}

      {lastSync && (
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          Last sync: {new Date(lastSync.durationMs).toISOString().substring(11, 19)}
        </span>
      )}

      {onSync && connectionStatus !== 'offline' && !syncing && (
        <button onClick={onSync} style={{ fontSize: '12px' }}>
          Sync Now
        </button>
      )}
    </div>
  );
};
