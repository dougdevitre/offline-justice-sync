/**
 * @module QueryEngine
 * @description Local query engine for searching and filtering documents
 * in the local-first database. Supports indexing and full-text search.
 */

import type { LocalDocument, QueryFilter } from '../types';

/**
 * QueryEngine provides local queries, indexing, and search capabilities.
 *
 * @example
 * ```typescript
 * const engine = new QueryEngine();
 * const results = engine.filter(documents, [
 *   { field: 'status', operator: '=', value: 'active' },
 *   { field: 'priority', operator: '>=', value: 3 },
 * ]);
 * ```
 */
export class QueryEngine {
  /**
   * Filter documents using multiple filters (AND logic).
   * @param docs - Documents to filter
   * @param filters - Array of query filters
   * @returns Filtered documents
   */
  filter<T>(docs: LocalDocument<T>[], filters: QueryFilter[]): LocalDocument<T>[] {
    return docs.filter((doc) =>
      filters.every((filter) => this.matchesFilter(doc, filter))
    );
  }

  /**
   * Sort documents by a field.
   * @param docs - Documents to sort
   * @param field - Field to sort by
   * @param direction - Sort direction
   * @returns Sorted documents
   */
  sort<T>(docs: LocalDocument<T>[], field: string, direction: 'asc' | 'desc' = 'asc'): LocalDocument<T>[] {
    return [...docs].sort((a, b) => {
      const aVal = (a.data as Record<string, unknown>)[field];
      const bVal = (b.data as Record<string, unknown>)[field];
      const comparison = String(aVal).localeCompare(String(bVal));
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Full-text search across document fields.
   * @param docs - Documents to search
   * @param query - Search query
   * @param fields - Fields to search in
   * @returns Matching documents
   */
  search<T>(docs: LocalDocument<T>[], query: string, fields: string[]): LocalDocument<T>[] {
    const lower = query.toLowerCase();
    return docs.filter((doc) =>
      fields.some((field) => {
        const value = (doc.data as Record<string, unknown>)[field];
        return value && String(value).toLowerCase().includes(lower);
      })
    );
  }

  private matchesFilter<T>(doc: LocalDocument<T>, filter: QueryFilter): boolean {
    const value = (doc.data as Record<string, unknown>)[filter.field];
    switch (filter.operator) {
      case '=': return value === filter.value;
      case '!=': return value !== filter.value;
      case '>': return (value as number) > (filter.value as number);
      case '<': return (value as number) < (filter.value as number);
      case '>=': return (value as number) >= (filter.value as number);
      case '<=': return (value as number) <= (filter.value as number);
      case 'contains': return String(value).includes(String(filter.value));
      default: return true;
    }
  }
}
