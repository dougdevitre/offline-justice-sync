/**
 * @example Offline Form Submission
 * @description Demonstrates submitting a form while offline.
 * The submission is stored locally and synced when connectivity returns.
 *
 * Usage: npx ts-node examples/offline-form-submit.ts
 */

import { LocalStore, ConnectionMonitor, SyncEngine } from '../src';

async function main() {
  // Initialize the local store
  const store = new LocalStore({ database: 'indexeddb', name: 'intake-app' });
  await store.initialize();

  console.log('=== Offline Form Submission Demo ===\n');

  // Simulate being offline
  console.log('Status: OFFLINE');
  console.log('Submitting intake form...\n');

  // Submit a form — works entirely offline
  const submission = await store.put('submissions', {
    id: `sub-${Date.now()}`,
    fullName: 'Jane Smith',
    email: 'jane.smith@example.com',
    issueType: 'Eviction',
    description: 'Received a 30-day notice but believe it is retaliatory.',
    urgency: 'Urgent',
    submittedAt: new Date().toISOString(),
  });

  console.log('Form submitted locally:');
  console.log(`  ID: ${submission.id}`);
  console.log(`  Sync Status: ${submission.syncStatus}`);
  console.log(`  Dirty: ${submission.dirty}`);
  console.log();

  // Check pending operations
  const pending = await store.getPendingCount();
  console.log(`Pending operations: ${pending}`);
  console.log();

  // Simulate going online and syncing
  console.log('Status: ONLINE');
  console.log('Starting sync...\n');

  const sync = new SyncEngine({
    localStore: store,
    remoteUrl: 'https://api.justice-os.org/sync',
  });

  const result = await sync.syncAll();
  console.log('Sync complete:');
  console.log(`  Pushed: ${result.pushed}`);
  console.log(`  Pulled: ${result.pulled}`);
  console.log(`  Conflicts: ${result.conflicts}`);
  console.log(`  Duration: ${result.durationMs}ms`);
}

main().catch(console.error);
