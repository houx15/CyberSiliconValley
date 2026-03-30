import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  real,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// --- users ---
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().$type<'talent' | 'enterprise'>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- talentProfiles ---
export const talentProfiles = pgTable('talent_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 255 }),
  headline: varchar('headline', { length: 500 }),
  bio: text('bio'),
  skills: jsonb('skills').$type<object[]>().default([]),
  experience: jsonb('experience').$type<object[]>().default([]),
  education: jsonb('education').$type<object[]>().default([]),
  goals: jsonb('goals').$type<object>().default({}),
  availability: varchar('availability', { length: 20 }).default('open'),
  salaryRange: jsonb('salary_range').$type<object>(),
  resumeUrl: varchar('resume_url', { length: 500 }),
  profileData: jsonb('profile_data').$type<object>().default({}),
  onboardingDone: boolean('onboarding_done').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- enterpriseProfiles ---
export const enterpriseProfiles = pgTable('enterprise_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  companyName: varchar('company_name', { length: 255 }),
  industry: varchar('industry', { length: 100 }),
  companySize: varchar('company_size', { length: 50 }),
  website: varchar('website', { length: 500 }),
  description: text('description'),
  aiMaturity: varchar('ai_maturity', { length: 50 }),
  profileData: jsonb('profile_data').$type<object>().default({}),
  preferences: jsonb('preferences').$type<object>().default({}),
  onboardingDone: boolean('onboarding_done').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- jobs ---
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    enterpriseId: uuid('enterprise_id')
      .notNull()
      .references(() => enterpriseProfiles.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    structured: jsonb('structured').notNull(),
    status: varchar('status', { length: 20 }).default('open').notNull(),
    autoMatch: boolean('auto_match').default(true).notNull(),
    autoPrechat: boolean('auto_prechat').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('jobs_status_created_at_idx').on(table.status, table.createdAt)]
);

// --- matches ---
export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    talentId: uuid('talent_id')
      .notNull()
      .references(() => talentProfiles.id, { onDelete: 'cascade' }),
    score: real('score').notNull(),
    breakdown: jsonb('breakdown').notNull(),
    status: varchar('status', { length: 20 }).default('new').notNull(),
    aiReasoning: text('ai_reasoning'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('matches_job_talent_unique').on(table.jobId, table.talentId),
    index('matches_job_id_idx').on(table.jobId),
    index('matches_talent_id_idx').on(table.talentId),
    index('matches_score_idx').on(table.score),
  ]
);

// --- chatSessions ---
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionType: varchar('session_type', { length: 30 }).notNull(),
  context: jsonb('context').$type<object>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- chatMessages ---
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<object>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('chat_messages_session_created_idx').on(table.sessionId, table.createdAt)]
);

// --- inboxItems ---
export const inboxItems = pgTable(
  'inbox_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemType: varchar('item_type', { length: 30 }).notNull(),
    title: varchar('title', { length: 255 }),
    content: jsonb('content').notNull(),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('inbox_items_user_read_created_idx').on(table.userId, table.read, table.createdAt)]
);

// --- apiKeys ---
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(),
  name: varchar('name', { length: 100 }),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- seekingReports ---
export const seekingReports = pgTable('seeking_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  talentId: uuid('talent_id')
    .notNull()
    .references(() => talentProfiles.id, { onDelete: 'cascade' }),
  reportData: jsonb('report_data').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

// --- keywordNodes ---
export const keywordNodes = pgTable('keyword_nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  keyword: varchar('keyword', { length: 100 }).notNull().unique(),
  jobCount: integer('job_count').default(0).notNull(),
  trending: boolean('trending').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- keywordEdges ---
export const keywordEdges = pgTable(
  'keyword_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => keywordNodes.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => keywordNodes.id, { onDelete: 'cascade' }),
    weight: real('weight').default(1.0).notNull(),
  },
  (table) => [unique('keyword_edges_source_target_unique').on(table.sourceId, table.targetId)]
);
