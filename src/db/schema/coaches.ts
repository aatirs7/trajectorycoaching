import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { coachStatus } from './enums'
import { users } from './users'

/** Spec §5. */
export const coachProfiles = pgTable(
  'coach_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Open set — `text`, not an enum. New industries must not require a migration. */
    industry: text('industry').notNull(),

    /**
     * Spec §4 calls this `current_role`. RENAMED: CURRENT_ROLE is a reserved keyword
     * in Postgres — Drizzle quotes identifiers so it would work, but every hand-written
     * psql query becomes a quoting trap. It also disambiguates from `users.role`, which
     * is a genuinely different concept (job title vs. auth role).
     */
    currentTitle: text('current_title').notNull(),

    bio: text('bio').notNull(),
    headshotUrl: text('headshot_url'),

    /** Spec §12: required for vetting. Enforced in the schema, not just the form. */
    linkedinUrl: text('linkedin_url').notNull(),

    employerNote: text('employer_note'),

    /**
     * Spec §6. Auto-generated. Normalized to uppercase on write and looked up on
     * uppercase — avoids needing the citext extension for case-insensitive matching.
     */
    referralCode: text('referral_code').notNull().unique(),

    /**
     * Spec §9 — the coach's host URI inside the Trajectory Calendly org. This is the
     * API URI (https://api.calendly.com/users/<uuid>) and is what we call the API with.
     */
    calendlyUserUri: text('calendly_user_uri'),

    /**
     * The coach's PUBLIC scheduling page (https://calendly.com/<slug>), used for the §8
     * read-only "view schedule" embed. Distinct from calendlyUserUri — the API URI can't
     * be iframed and the public slug can't be derived from it, so both are stored.
     */
    calendlySchedulingUrl: text('calendly_scheduling_url'),

    /** Spec §10 — Stripe Connect Express account. Nullable until onboarding completes. */
    stripeAccountId: text('stripe_account_id'),

    /**
     * Hard rule §2.4 expressed as a DB default: new profiles are `pending` and
     * invisible/unbookable. The app does not get to choose the initial status.
     */
    status: coachStatus('status').notNull().default('pending'),

    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('coach_profiles_status_idx').on(t.status), index('coach_profiles_industry_idx').on(t.industry)],
)

/** Spec §5 — a coach may offer multiple session lengths at different rates. */
export const coachOfferings = pgTable(
  'coach_offerings',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** → users.id (see the convention note in users.ts), not coach_profiles.id. */
    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** smallint + CHECK rather than an enum: this value gets arithmetic done to it. */
    lengthMinutes: smallint('length_minutes').notNull(),

    priceCents: integer('price_cents').notNull(),

    /**
     * Not in the spec. `sessions.offering_id` FKs here, so offerings can never be hard
     * deleted without orphaning session history. Soft-delete from day one.
     */
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    /** A coach cannot have two 30-minute offerings at different prices. */
    unique('coach_offerings_coach_length_unq').on(t.coachId, t.lengthMinutes),
    check('coach_offerings_length_allowed', sql`${t.lengthMinutes} IN (30, 45, 60)`),
    check('coach_offerings_price_positive', sql`${t.priceCents} > 0`),
    index('coach_offerings_coach_idx').on(t.coachId),
  ],
)

/**
 * Note: offerings hang off `users`, not `coach_profiles` (see the FK convention in
 * users.ts), so there is deliberately no `coachProfiles.offerings` relation here —
 * go `coachProfiles.user → user.offerings` instead.
 */
export const coachProfilesRelations = relations(coachProfiles, ({ one }) => ({
  user: one(users, { fields: [coachProfiles.userId], references: [users.id], relationName: 'coach_profile_user' }),
  approver: one(users, { fields: [coachProfiles.approvedBy], references: [users.id], relationName: 'coach_approver' }),
}))

export const coachOfferingsRelations = relations(coachOfferings, ({ one }) => ({
  coach: one(users, { fields: [coachOfferings.coachId], references: [users.id] }),
}))
