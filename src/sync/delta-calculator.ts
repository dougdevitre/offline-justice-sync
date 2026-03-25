/**
 * @module DeltaCalculator
 * @description Computes minimal diffs between document versions for
 * bandwidth-efficient synchronization. Only transfers what changed.
 */

import type { QueuedOperation } from '../types';

/**
 * DeltaCalculator computes minimal diffs for efficient sync.
 *
 * @example
 * ```typescript
 * const calculator = new DeltaCalculator();
 * const deltas = calculator.calculate(operations);
 * ```
 */
export class DeltaCalculator {
  /**
   * Calculate minimal deltas from queued operations.
   * Collapses multiple operations on the same document into a single delta.
   *
   * @param operations - Queued operations to process
   * @returns Optimized operations (collapsed and deduplicated)
   */
  calculate(operations: QueuedOperation[]): QueuedOperation[] {
    // Group by document ID — keep only the latest operation per document
    const byDocument = new Map<string, QueuedOperation>();

    for (const op of operations) {
      const key = `${op.collection}:${op.documentId}`;
      const existing = byDocument.get(key);

      if (!existing || op.createdAt > existing.createdAt) {
        byDocument.set(key, op);
      }
    }

    // If a put was followed by a delete, keep only the delete
    return Array.from(byDocument.values()).filter((op) => {
      if (op.type === 'delete') return true;
      // Check if there's a later delete for this document
      const key = `${op.collection}:${op.documentId}`;
      const latest = byDocument.get(key);
      return latest && latest.type !== 'delete';
    });
  }

  /**
   * Compute a field-level diff between two document versions.
   *
   * @param previous - Previous version
   * @param current - Current version
   * @returns Object with only changed fields
   */
  diff(
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(current)) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(value)) {
        changes[key] = value;
      }
    }

    // Detect deletions
    for (const key of Object.keys(previous)) {
      if (!(key in current)) {
        changes[key] = null;
      }
    }

    return changes;
  }
}
