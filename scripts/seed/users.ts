import { eq } from 'drizzle-orm';

import { hashPassword } from '../../src/lib/auth';
import { db } from '../../src/lib/db';
import { users } from '../../src/lib/db/schema';

const PREDEFINED_ACCOUNTS = [
  { email: 'talent1@csv.dev', role: 'talent' as const },
  { email: 'talent2@csv.dev', role: 'talent' as const },
  { email: 'talent3@csv.dev', role: 'talent' as const },
  { email: 'enterprise1@csv.dev', role: 'enterprise' as const },
  { email: 'enterprise2@csv.dev', role: 'enterprise' as const },
];

const DEFAULT_PASSWORD = 'csv2026';

export async function seedUsers(): Promise<string[]> {
  console.log('🔑 Seeding predefined user accounts...');

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const createdIds: string[] = [];

  for (const account of PREDEFINED_ACCOUNTS) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ✓ ${account.email} already exists (${existing[0]!.id})`);
      createdIds.push(existing[0]!.id);
      continue;
    }

    const [created] = await db
      .insert(users)
      .values({
        email: account.email,
        passwordHash,
        role: account.role,
      })
      .returning({ id: users.id });

    if (created) {
      console.log(`  + ${account.email} created (${created.id})`);
      createdIds.push(created.id);
    }
  }

  console.log(`✅ ${createdIds.length} user accounts ready.\n`);
  return createdIds;
}
