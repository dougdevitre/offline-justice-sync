/**
 * @module RetryQueue
 * @description Manages retry logic with exponential backoff for failed
 * sync operations. Prioritizes critical operations and respects limits.
 */

import type { QueuedOperation } from '../types';

/**
 * RetryQueue manages failed operations with exponential backoff.
 *
 * @example
 * ```typescript
 * const queue = new RetryQueue(5);
 * queue.scheduleRetry(failedOperation);
 * const ready = queue.getReady();
 * ```
 */
export class RetryQueue {
  private maxRetries: number;
  private queue: QueuedOperation[] = [];

  constructor(maxRetries: number = 5) {
    this.maxRetries = maxRetries;
  }

  /**
   * Schedule an operation for retry with exponential backoff.
   * @param operation - The failed operation
   * @returns True if scheduled, false if max retries exceeded
   */
  scheduleRetry(operation: QueuedOperation): boolean {
    if (operation.retryCount >= this.maxRetries) {
      operation.status = 'failed';
      return false;
    }

    operation.retryCount++;
    operation.status = 'pending';

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
    const delayMs = Math.pow(2, operation.retryCount) * 1000;
    operation.scheduledAt = new Date(Date.now() + delayMs);

    this.queue.push(operation);
    return true;
  }

  /**
   * Get operations that are ready to retry (scheduled time has passed).
   * @returns Operations ready for retry
   */
  getReady(): QueuedOperation[] {
    const now = new Date();
    const ready = this.queue.filter(
      (op) => op.status === 'pending' && op.scheduledAt <= now
    );

    // Remove from queue
    this.queue = this.queue.filter((op) => !ready.includes(op));

    return ready;
  }

  /**
   * Get the count of operations pending retry.
   */
  getPendingCount(): number {
    return this.queue.filter((op) => op.status === 'pending').length;
  }

  /**
   * Clear all retry operations.
   */
  clear(): void {
    this.queue = [];
  }
}
