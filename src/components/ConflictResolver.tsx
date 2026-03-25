/**
 * @module ConflictResolverUI
 * @description React component for manual conflict resolution.
 * Presents side-by-side comparison of local and remote versions
 * and lets the user choose which version to keep.
 */

import React, { useState } from 'react';
import type { ConflictRecord } from '../types';

/**
 * Props for the ConflictResolver component
 */
export interface ConflictResolverProps {
  /** The conflict to resolve */
  conflict: ConflictRecord;
  /** Callback when the conflict is resolved */
  onResolve: (conflictId: string, resolution: 'local' | 'remote' | 'merged', mergedData?: Record<string, unknown>) => void;
  /** Custom CSS class name */
  className?: string;
}

/**
 * ConflictResolverUI provides a side-by-side comparison of conflicting
 * document versions, allowing users to choose or merge.
 *
 * @example
 * ```tsx
 * <ConflictResolverUI
 *   conflict={conflictRecord}
 *   onResolve={(id, resolution) => handleResolve(id, resolution)}
 * />
 * ```
 */
export const ConflictResolverUI: React.FC<ConflictResolverProps> = ({
  conflict,
  onResolve,
  className,
}) => {
  const [selectedSide, setSelectedSide] = useState<'local' | 'remote' | null>(null);

  const handleResolve = () => {
    if (selectedSide) {
      onResolve(conflict.id, selectedSide);
    }
  };

  return (
    <div className={className} data-testid="conflict-resolver">
      <h3>Conflict Detected</h3>
      <p>Document <strong>{conflict.documentId}</strong> in <strong>{conflict.collection}</strong> has conflicting changes.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div
          onClick={() => setSelectedSide('local')}
          style={{
            padding: '16px',
            border: selectedSide === 'local' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <h4>Your Version (Local)</h4>
          <pre style={{ fontSize: '12px', overflow: 'auto' }}>
            {JSON.stringify(conflict.localVersion, null, 2)}
          </pre>
        </div>

        <div
          onClick={() => setSelectedSide('remote')}
          style={{
            padding: '16px',
            border: selectedSide === 'remote' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <h4>Server Version (Remote)</h4>
          <pre style={{ fontSize: '12px', overflow: 'auto' }}>
            {JSON.stringify(conflict.remoteVersion, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={handleResolve} disabled={!selectedSide}>
          Keep {selectedSide === 'local' ? 'Your' : 'Server'} Version
        </button>
      </div>
    </div>
  );
};
