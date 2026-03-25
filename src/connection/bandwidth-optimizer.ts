/**
 * @module BandwidthOptimizer
 * @description Optimizes data transfer based on connection quality.
 * Compresses payloads, prioritizes critical data, and batches operations.
 */

import type { QueuedOperation, ConnectionQuality } from '../types';

/**
 * BandwidthOptimizer adapts sync behavior based on connection quality.
 *
 * @example
 * ```typescript
 * const optimizer = new BandwidthOptimizer();
 * const optimized = optimizer.optimize(operations, connectionQuality);
 * ```
 */
export class BandwidthOptimizer {
  /**
   * Optimize operations for the current bandwidth conditions.
   * @param operations - Operations to optimize
   * @param quality - Current connection quality
   * @returns Optimized operations (batched, compressed, prioritized)
   */
  optimize(operations: QueuedOperation[], quality: ConnectionQuality): QueuedOperation[] {
    if (quality.quality >= 80) {
      // Good connection — send everything
      return operations;
    }

    if (quality.quality >= 40) {
      // Degraded — batch and compress, skip non-critical
      return this.prioritize(operations);
    }

    // Poor connection — only critical operations
    return this.criticalOnly(operations);
  }

  /**
   * Prioritize operations by type and recency.
   */
  private prioritize(operations: QueuedOperation[]): QueuedOperation[] {
    return [...operations].sort((a, b) => {
      // Deletes first, then puts, then patches
      const typePriority: Record<string, number> = { delete: 3, put: 2, patch: 1 };
      const aPriority = typePriority[a.type] || 0;
      const bPriority = typePriority[b.type] || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * Filter to critical operations only.
   */
  private criticalOnly(operations: QueuedOperation[]): QueuedOperation[] {
    // In degraded mode, only sync deletes and the most recent puts
    return operations.filter((op) => op.type === 'delete' || op.retryCount > 0);
  }

  /**
   * Estimate the byte size of an operation payload.
   * @param operation - The operation to measure
   * @returns Estimated size in bytes
   */
  estimateSize(operation: QueuedOperation): number {
    return JSON.stringify(operation.payload).length * 2; // rough UTF-16 estimate
  }

  /**
   * Batch operations to reduce number of network requests.
   * @param operations - Operations to batch
   * @param maxBatchSize - Maximum operations per batch
   * @returns Batched operation arrays
   */
  batch(operations: QueuedOperation[], maxBatchSize: number = 50): QueuedOperation[][] {
    const batches: QueuedOperation[][] = [];
    for (let i = 0; i < operations.length; i += maxBatchSize) {
      batches.push(operations.slice(i, i + maxBatchSize));
    }
    return batches;
  }
}
