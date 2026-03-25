/**
 * @module OfflineBanner
 * @description React component that displays a non-intrusive banner
 * when the device is offline, reassuring users that their work is safe.
 */

import React from 'react';

/**
 * Props for the OfflineBanner component
 */
export interface OfflineBannerProps {
  /** Whether the device is currently offline */
  isOffline: boolean;
  /** Number of pending operations queued for sync */
  pendingCount: number;
  /** Custom CSS class name */
  className?: string;
}

/**
 * OfflineBanner shows a reassuring message when the device is offline,
 * letting users know their work is saved locally and will sync later.
 *
 * @example
 * ```tsx
 * <OfflineBanner isOffline={true} pendingCount={5} />
 * ```
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  pendingCount,
  className,
}) => {
  if (!isOffline) return null;

  return (
    <div
      className={className}
      data-testid="offline-banner"
      role="status"
      style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '4px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span aria-hidden="true">Offline Mode</span>
      <span>
        You are working offline. Your changes are saved locally
        {pendingCount > 0 && ` (${pendingCount} changes queued)`}.
        Everything will sync when you reconnect.
      </span>
    </div>
  );
};
