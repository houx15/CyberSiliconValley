import 'dotenv/config';
import { db } from '../src/lib/db';
import { users, talentProfiles, enterpriseProfiles } from '../src/lib/db/schema';
import { hashPassword } from '../src/lib/auth';

async function seedUsers() {
  console.log('Seeding predefined accounts...');

  const password = await hashPassword('csv2026');

  const accounts = [
    { email: 'talent1@csv.dev', role: 'talent' },
    { email: 'talent2@csv.dev', role: 'talent' },
    { email: 'talent3@csv.dev', role: 'talent' },
    { email: 'enterprise1@csv.dev', role: 'enterprise' },
    { email: 'enterprise2@csv.dev', role: 'enterprise' },
  ];

  for (const account of accounts) {
    const [user] = await db
      .insert(users)
      .values({ email: account.email, passwordHash: password, role: account.role as 'talent' | 'enterprise' })
      .onConflictDoNothing()
      .returning();

    if (user) {
      if (account.role === 'talent') {
        await db.insert(talentProfiles).values({ userId: user.id }).onConflictDoNothing();
      } else {
        await db.insert(enterpriseProfiles).values({ userId: user.id }).onConflictDoNothing();
      }
      console.log(`  Created: ${account.email} (${account.role})`);
    } else {
      console.log(`  Skipped: ${account.email} (already exists)`);
    }
  }

  console.log('Done.');
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
