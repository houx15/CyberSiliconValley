import { describe, it, expect } from 'vitest';
import * as schema from '../schema';

describe('DB Schema', () => {
  describe('expected tables are exported', () => {
    const expectedTables = [
      'users',
      'talentProfiles',
      'enterpriseProfiles',
      'jobs',
      'matches',
      'chatSessions',
      'chatMessages',
      'inboxItems',
      'apiKeys',
      'seekingReports',
      'keywordNodes',
      'keywordEdges',
    ];

    for (const tableName of expectedTables) {
      it(`exports ${tableName}`, () => {
        expect(schema).toHaveProperty(tableName);
        expect((schema as Record<string, unknown>)[tableName]).toBeDefined();
      });
    }
  });

  describe('users table has expected columns', () => {
    it('has email column', () => {
      const tableAny = schema.users as any;
      expect(tableAny.email).toBeDefined();
    });

    it('has passwordHash column', () => {
      const tableAny = schema.users as any;
      expect(tableAny.passwordHash).toBeDefined();
    });

    it('has role column', () => {
      const tableAny = schema.users as any;
      expect(tableAny.role).toBeDefined();
    });

    it('has id column', () => {
      const tableAny = schema.users as any;
      expect(tableAny.id).toBeDefined();
    });

    it('has createdAt column', () => {
      const tableAny = schema.users as any;
      expect(tableAny.createdAt).toBeDefined();
    });
  });

  describe('talentProfiles table has expected columns', () => {
    it('has skills column', () => {
      const tableAny = schema.talentProfiles as any;
      expect(tableAny.skills).toBeDefined();
    });

    it('has experience column', () => {
      const tableAny = schema.talentProfiles as any;
      expect(tableAny.experience).toBeDefined();
    });

    it('has userId column referencing users', () => {
      const tableAny = schema.talentProfiles as any;
      expect(tableAny.userId).toBeDefined();
    });

    it('has onboardingDone column', () => {
      const tableAny = schema.talentProfiles as any;
      expect(tableAny.onboardingDone).toBeDefined();
    });

    it('has profileData column for embedding-related data', () => {
      const tableAny = schema.talentProfiles as any;
      expect(tableAny.profileData).toBeDefined();
    });
  });

  describe('jobs table has expected columns', () => {
    it('has structured column', () => {
      const tableAny = schema.jobs as any;
      expect(tableAny.structured).toBeDefined();
    });

    it('has status column', () => {
      const tableAny = schema.jobs as any;
      expect(tableAny.status).toBeDefined();
    });

    it('has title column', () => {
      const tableAny = schema.jobs as any;
      expect(tableAny.title).toBeDefined();
    });

    it('has enterpriseId column', () => {
      const tableAny = schema.jobs as any;
      expect(tableAny.enterpriseId).toBeDefined();
    });

    it('has autoMatch column', () => {
      const tableAny = schema.jobs as any;
      expect(tableAny.autoMatch).toBeDefined();
    });
  });

  describe('matches table has expected columns', () => {
    it('has score column', () => {
      const tableAny = schema.matches as any;
      expect(tableAny.score).toBeDefined();
    });

    it('has breakdown column', () => {
      const tableAny = schema.matches as any;
      expect(tableAny.breakdown).toBeDefined();
    });

    it('has status column', () => {
      const tableAny = schema.matches as any;
      expect(tableAny.status).toBeDefined();
    });
  });
});
