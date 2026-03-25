/**
 * @example Sync on Reconnect
 * @description Demonstrates the full offline-to-online workflow:
 * work offline, queue changes, detect reconnection, and sync.
 *
 * Usage: npx ts-node examples/sync-on-reconnect.ts
 */

import { LocalStore, SyncEngine, ConnectionMonitor } from '../src';

async function main() {
  console.log('=== Sync on Reconnect Demo ===\n');

  // Initialize store
  const store = new LocalStore({ database: 'indexeddb', name: 'case-tracker' });
  await store.initialize();

  // Work offline — add several case updates
  console.log('Phase 1: Working OFFLINE\n');

  await store.put('cases', { id: 'case-001', title: 'Housing Dispute', status: 'active', notes: 'Initial filing prepared' });
  await store.put('cases', { id: 'case-002', title: 'Employment Issue', status: 'review', notes: 'Documentation gathered' });
  await store.put('cases', { id: 'case-003', title: 'Family Matter', status: 'active', notes: 'Mediation scheduled' });

  // Update an existing case
  await store.put('cases', { id: 'case-001', title: 'Housing Dispute', status: 'active', notes: 'Motion filed, awaiting response' });

  // Delete a case
  await store.delete('cases', 'case-002');

  const pendingOps = await store.getPendingCount();
  console.log(`Operations performed offline: ${pendingOps}`);
  console.log();

  // Query local data (works offline)
  const activeCases = await store.query('cases', {
    field: 'status',
    operator: '=',
    value: 'active',
  });
  console.log(`Active cases (local query): ${activeCases.length}`);
  for (const c of activeCases) {
    console.log(`  - ${c.data.title}: ${c.data.notes}`);
  }
  console.log();

  // Simulate reconnection
  console.log('Phase 2: Connection RESTORED\n');

  const sync = new SyncEngine({
    localStore: store,
    remoteUrl: 'https://api.justice-os.org/sync',
    conflictStrategy: 'field-merge',
  });

  sync.on('sync:start', () => console.log('Sync started...'));
  sync.on('sync:complete', (result: unknown) => {
    const r = result as { pushed: number; pulled: number; conflicts: number; durationMs: number };
    console.log(`Sync complete: pushed=${r.pushed}, pulled=${r.pulled}, conflicts=${r.conflicts}, duration=${r.durationMs}ms`);
  });

  // Trigger sync
  const result = await sync.syncAll();

  console.log();
  console.log('=== Sync Summary ===');
  console.log(`  Pushed: ${result.pushed}`);
  console.log(`  Pulled: ${result.pulled}`);
  console.log(`  Conflicts: ${result.conflicts}`);
  console.log(`  Auto-resolved: ${result.autoResolved}`);
  console.log(`  Manual conflicts: ${result.manualConflicts.length}`);
  console.log(`  Errors: ${result.errors.length}`);
}

main().catch(console.error);
