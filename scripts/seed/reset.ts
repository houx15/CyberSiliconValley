import { sql } from 'drizzle-orm';

import { db } from '../../src/lib/db';

export async function resetDatabase(): Promise<void> {
  console.log('🗑️  Resetting database...');

  const tables = [
    'seeking_reports',
    'keyword_edges',
    'keyword_nodes',
    'inbox_items',
    'matches',
    'chat_messages',
    'chat_sessions',
    'api_keys',
    'jobs',
    'enterprise_profiles',
    'talent_profiles',
    'users',
  ];

  for (const table of tables) {
    await db.execute(sql.raw(`DELETE FROM ${table}`));
    console.log(`  ✓ Cleared ${table}`);
  }

  console.log('✅ Database reset complete.\n');
}
