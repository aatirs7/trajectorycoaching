import { relations, sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { coachOfferings } from './coaches'
import { sessionStatus } from './enums'
import { coachStudentLinks } from './links'
import { users } from './users'

/**
 * Spec §8/§10/§11 — a paid coaching session.
 *
 * Lifecycle: paid_unscheduled → booked → (rescheduled) → completed
 * Cancel branches: canceled_free (≥24h) → refunded, or canceled_late (<24h, no refund).
 * Payment always precedes scheduling (§8), so a row exists before Calendly is involved.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    offeringId: uuid('offering_id')
      .notNull()
      .references(() => coachOfferings.id, { onDelete: 'restrict' }),

    /**
     * Not in spec §4. Makes commission provenance auditable per session: proving why a
     * given session charged 20% is a join, not an archaeology exercise reconstructing
     * the pair's link row and hoping nothing drifted. Directly supports the §2.2
     * "frozen and dumb by design" audit story.
     */
    linkId: uuid('link_id')
      .notNull()
      .references(() => coachStudentLinks.id, { onDelete: 'restrict' }),

    amountCents: integer('amount_cents').notNull(),
    commissionCents: integer('commission_cents').notNull(),
    coachPayoutCents: integer('coach_payout_cents').notNull(),

    status: sessionStatus('status').notNull().default('paid_unscheduled'),

    /**
     * Nullable so admin/test/comped sessions can exist without a Stripe object;
     * presence is enforced in the app layer for real bookings.
     * UNIQUE because this is a webhook idempotency key — Stripe retries.
     */
    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),

    calendlyEventUri: text('calendly_event_uri'),

    /**
     * UNIQUE: the §9 idempotency key. Calendly retries `invitee.created`; without this
     * constraint a retry double-books.
     */
    calendlyInviteeUri: text('calendly_invitee_uri').unique(),

    scheduledStart: timestamp('scheduled_start', { withTimezone: true, mode: 'date' }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true, mode: 'date' }),

    /** §11: set by the completion cron once scheduled_end passes. */
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),

    /**
     * §12 reminders. Not in spec §4, but without it an hourly reminder job re-sends to
     * everyone whose session is still inside the window on the next tick. This column IS
     * the idempotency key for the reminder — a time window alone isn't one.
     */
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    /**
     * The money invariant, enforced by Postgres. `splitAmount()` in lib/commission.ts
     * derives payout as (amount − commission) rather than rounding both independently,
     * which is what keeps this from ever firing on a rounding cent.
     */
    check(
      'sessions_amount_split_balances',
      sql`${t.amountCents} = ${t.commissionCents} + ${t.coachPayoutCents}`,
    ),
    check('sessions_amount_positive', sql`${t.amountCents} > 0`),
    check('sessions_commission_non_negative', sql`${t.commissionCents} >= 0`),
    check('sessions_payout_non_negative', sql`${t.coachPayoutCents} >= 0`),

    /** §12 dashboards, both roles. */
    index('sessions_coach_start_idx').on(t.coachId, t.scheduledStart),
    index('sessions_student_start_idx').on(t.studentId, t.scheduledStart),
    /** §11 completion cron. */
    index('sessions_status_end_idx').on(t.status, t.scheduledEnd),
    index('sessions_link_idx').on(t.linkId),
  ],
)

/** Spec §12 — brief post-session notes from the coach, visible to that student. */
export const sessionNotes = pgTable(
  'session_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),

    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    body: text('body').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('session_notes_session_idx').on(t.sessionId)],
)

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  coach: one(users, { fields: [sessions.coachId], references: [users.id], relationName: 'session_coach' }),
  student: one(users, { fields: [sessions.studentId], references: [users.id], relationName: 'session_student' }),
  offering: one(coachOfferings, { fields: [sessions.offeringId], references: [coachOfferings.id] }),
  link: one(coachStudentLinks, { fields: [sessions.linkId], references: [coachStudentLinks.id] }),
  notes: many(sessionNotes),
}))

export const sessionNotesRelations = relations(sessionNotes, ({ one }) => ({
  session: one(sessions, { fields: [sessionNotes.sessionId], references: [sessions.id] }),
  coach: one(users, { fields: [sessionNotes.coachId], references: [users.id] }),
}))
