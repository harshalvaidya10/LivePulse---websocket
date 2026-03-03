import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

export const matchStatus = pgEnum('match_status', ['scheduled', 'live', 'finished']);

export const matches = pgTable(
  'matches',
  {
    id: serial('id').primaryKey(),

    // ✅ NEW: provider identity (nullable for manual matches)
    provider: text('provider'),                 // e.g. 'api-sports'
    providerMatchId: integer('provider_match_id'), // e.g. API-Sports fixture id

    sport: text('sport').notNull(),
    homeTeam: text('home_team').notNull(),
    awayTeam: text('away_team').notNull(),
    homeTeamLogo: text('home_team_logo'),
    awayTeamLogo: text('away_team_logo'),
    league: text('league'),
    country: text('country'),
    status: matchStatus('status').default('scheduled').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    homeScore: integer('home_score').default(0).notNull(),
    awayScore: integer('away_score').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => ({
    // ✅ NEW: prevent duplicates for same provider fixture
    providerMatchUnique: uniqueIndex('matches_provider_provider_match_id_uq').on(
      t.provider,
      t.providerMatchId
    ),
  })
);

export const commentary = pgTable(
  'commentary',
  {
    id: serial('id').primaryKey(),

    // ✅ NEW for dedupe
    provider: text('provider'),
    providerEventKey: text('provider_event_key'),

    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),

    minutes: integer('minutes').notNull(),
    sequence: integer('sequence').notNull(),
    period: text('period').notNull(),
    eventType: text('event_type').notNull(),
    actor: text('actor'),
    team: text('team'),
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    tags: text('tags').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerEventUnique: uniqueIndex('commentary_provider_event_key_uq').on(
      t.provider,
      t.providerEventKey
    ),
  })
);
