import 'dotenv/config';

import {
  buildKeywordGraph,
  computeEmbeddings,
  computeMatches,
  ensureDemoHighMatches,
} from './seed/compute';
import { seedInboxItems, seedSeekingReports } from './seed/content';
import { seedJobs } from './seed/jobs';
import { seedEnterpriseProfiles, seedTalentProfiles } from './seed/profiles';
import { resetDatabase } from './seed/reset';
import { seedUsers } from './seed/users';

const COMMANDS: Record<string, () => Promise<void>> = {
  seed: async () => {
    console.log('═══════════════════════════════════════');
    console.log('  CSV Full Seed — Starting...');
    console.log('═══════════════════════════════════════\n');

    await seedUsers();
    await seedTalentProfiles();
    await seedEnterpriseProfiles();
    await seedJobs();
    await computeEmbeddings();
    await computeMatches();
    await ensureDemoHighMatches();
    await buildKeywordGraph();
    await seedInboxItems();
    await seedSeekingReports();

    console.log('\n═══════════════════════════════════════');
    console.log('  ✅ Full seed complete!');
    console.log('═══════════════════════════════════════');
  },
  'seed:users': async () => {
    await seedUsers();
  },
  'seed:profiles': async () => {
    await seedTalentProfiles();
    await seedEnterpriseProfiles();
  },
  'seed:jobs': async () => {
    await seedJobs();
  },
  'seed:compute': async () => {
    await computeEmbeddings();
    await computeMatches();
    await ensureDemoHighMatches();
    await buildKeywordGraph();
  },
  'seed:content': async () => {
    await seedInboxItems();
    await seedSeekingReports();
  },
  'seed:reset': async () => {
    if (!process.argv.includes('--yes')) {
      console.log('⚠️  This will DELETE ALL DATA. Run with --yes to confirm.');
      console.log('   npx tsx scripts/seed.ts seed:reset --yes');
      process.exitCode = 1;
      return;
    }

    await resetDatabase();
    await COMMANDS['seed']!();
  },
};

async function main() {
  const command = process.argv[2] ?? 'seed';
  const handler = COMMANDS[command];

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available commands: ${Object.keys(COMMANDS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  try {
    await handler();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  }
}

void main();
