/**
 * @module SchemaManager
 * @description Manages database schema versions and migrations for
 * the local-first database. Ensures smooth upgrades across versions.
 */

/**
 * A schema migration definition
 */
export interface Migration {
  /** Migration version number */
  version: number;
  /** Migration description */
  description: string;
  /** Migration function */
  up: () => Promise<void>;
  /** Rollback function */
  down: () => Promise<void>;
}

/**
 * SchemaManager handles database schema versioning and migrations.
 *
 * @example
 * ```typescript
 * const manager = new SchemaManager();
 * manager.addMigration({
 *   version: 2,
 *   description: 'Add status field',
 *   up: async () => { ... },
 *   down: async () => { ... },
 * });
 * await manager.migrate(2);
 * ```
 */
export class SchemaManager {
  private migrations: Migration[] = [];
  private currentVersion: number = 0;

  /**
   * Register a migration.
   * @param migration - The migration to register
   */
  addMigration(migration: Migration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Run migrations up to a target version.
   * @param targetVersion - The version to migrate to
   */
  async migrate(targetVersion: number): Promise<void> {
    const pending = this.migrations.filter(
      (m) => m.version > this.currentVersion && m.version <= targetVersion
    );

    for (const migration of pending) {
      await migration.up();
      this.currentVersion = migration.version;
    }
  }

  /**
   * Rollback to a target version.
   * @param targetVersion - The version to rollback to
   */
  async rollback(targetVersion: number): Promise<void> {
    const toRollback = this.migrations
      .filter((m) => m.version > targetVersion && m.version <= this.currentVersion)
      .reverse();

    for (const migration of toRollback) {
      await migration.down();
      this.currentVersion = migration.version - 1;
    }
  }

  /**
   * Get the current schema version.
   */
  getVersion(): number {
    return this.currentVersion;
  }
}
