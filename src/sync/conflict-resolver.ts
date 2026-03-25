/**
 * @module ConflictResolver
 * @description CRDT-based conflict resolution for handling concurrent
 * modifications to the same document from multiple offline clients.
 * Supports last-write-wins, field-level merge, and custom strategies.
 */

import type { ConflictStrategy, VectorClock } from '../types';

/**
 * Result of a conflict resolution
 */
export interface ResolutionResult {
  /** The merged document */
  merged: Record<string, unknown>;
  /** How the conflict was resolved */
  resolution: 'auto' | 'manual';
  /** Which strategy was used */
  strategy: ConflictStrategy;
  /** Description of what was merged */
  description: string;
}

/**
 * ConflictResolver uses CRDT principles to deterministically resolve
 * conflicts between local and remote versions of documents.
 *
 * @example
 * ```typescript
 * const resolver = new ConflictResolver('field-merge');
 * const result = resolver.resolve(localDoc, remoteDoc);
 * console.log(result.merged); // Merged version
 * console.log(result.resolution); // 'auto' or 'manual'
 * ```
 */
export class ConflictResolver {
  private strategy: ConflictStrategy;
  private customResolver?: (local: unknown, remote: unknown) => unknown;

  /**
   * Create a new ConflictResolver.
   * @param strategy - Default resolution strategy
   * @param customResolver - Custom resolver function (for 'custom' strategy)
   */
  constructor(strategy: ConflictStrategy = 'last-write-wins', customResolver?: (local: unknown, remote: unknown) => unknown) {
    this.strategy = strategy;
    this.customResolver = customResolver;
  }

  /**
   * Resolve a conflict between local and remote versions.
   *
   * @param local - The local version of the document
   * @param remote - The remote version of the document
   * @returns Resolution result with merged document
   */
  resolve(local: Record<string, unknown>, remote: Record<string, unknown>): ResolutionResult {
    switch (this.strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(local, remote);
      case 'field-merge':
        return this.fieldMerge(local, remote);
      case 'custom':
        return this.customResolve(local, remote);
      default:
        return this.lastWriteWins(local, remote);
    }
  }

  /**
   * Last-write-wins: the document with the most recent timestamp wins.
   */
  private lastWriteWins(local: Record<string, unknown>, remote: Record<string, unknown>): ResolutionResult {
    const localTime = new Date(local['updatedAt'] as string || 0).getTime();
    const remoteTime = new Date(remote['updatedAt'] as string || 0).getTime();

    const winner = localTime >= remoteTime ? local : remote;

    return {
      merged: { ...winner },
      resolution: 'auto',
      strategy: 'last-write-wins',
      description: `${localTime >= remoteTime ? 'Local' : 'Remote'} version selected (more recent timestamp)`,
    };
  }

  /**
   * Field-level merge: merge non-conflicting fields, flag conflicting ones.
   */
  private fieldMerge(local: Record<string, unknown>, remote: Record<string, unknown>): ResolutionResult {
    const merged: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    let hasManualConflict = false;
    const descriptions: string[] = [];

    for (const key of allKeys) {
      const localVal = local[key];
      const remoteVal = remote[key];

      if (localVal === undefined && remoteVal !== undefined) {
        // Only in remote — take remote
        merged[key] = remoteVal;
        descriptions.push(`${key}: took remote value`);
      } else if (localVal !== undefined && remoteVal === undefined) {
        // Only in local — take local
        merged[key] = localVal;
        descriptions.push(`${key}: kept local value`);
      } else if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
        // Same value — no conflict
        merged[key] = localVal;
      } else {
        // Conflict — take most recent based on timestamps, or flag
        if (key === 'updatedAt' || key === 'localUpdatedAt') {
          const lt = new Date(localVal as string).getTime();
          const rt = new Date(remoteVal as string).getTime();
          merged[key] = lt >= rt ? localVal : remoteVal;
        } else {
          // True conflict — for now, take local but flag for review
          merged[key] = localVal;
          merged[`_conflict_${key}`] = remoteVal;
          hasManualConflict = true;
          descriptions.push(`${key}: conflict detected — local kept, remote stored as _conflict_${key}`);
        }
      }
    }

    return {
      merged,
      resolution: hasManualConflict ? 'manual' : 'auto',
      strategy: 'field-merge',
      description: descriptions.join('; ') || 'No conflicting fields',
    };
  }

  /**
   * Custom resolution using a user-provided function.
   */
  private customResolve(local: Record<string, unknown>, remote: Record<string, unknown>): ResolutionResult {
    if (!this.customResolver) {
      return this.lastWriteWins(local, remote);
    }

    const merged = this.customResolver(local, remote) as Record<string, unknown>;
    return {
      merged,
      resolution: 'auto',
      strategy: 'custom',
      description: 'Resolved using custom resolver function',
    };
  }

  /**
   * Compare two vector clocks to determine causal ordering.
   *
   * @param a - First vector clock
   * @param b - Second vector clock
   * @returns 'before' | 'after' | 'concurrent'
   */
  compareClocks(a: VectorClock, b: VectorClock): 'before' | 'after' | 'concurrent' {
    let aBeforeB = false;
    let bBeforeA = false;
    const allNodes = new Set([...Object.keys(a.counters), ...Object.keys(b.counters)]);

    for (const node of allNodes) {
      const aCount = a.counters[node] || 0;
      const bCount = b.counters[node] || 0;

      if (aCount < bCount) aBeforeB = true;
      if (aCount > bCount) bBeforeA = true;
    }

    if (aBeforeB && !bBeforeA) return 'before';
    if (bBeforeA && !aBeforeB) return 'after';
    return 'concurrent';
  }
}
