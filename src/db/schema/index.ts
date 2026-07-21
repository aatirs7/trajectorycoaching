/**
 * MentorReach — core schema (spec §4).
 *
 * FK CONVENTION: every `mentor_id` / `student_id` column in every table references
 * `users.id`, never `mentor_profiles.id`. Join to mentor_profiles via its `user_id`.
 * See the header comment in ./users.ts.
 *
 * §2.2's hard rule is encoded by UNIQUE(mentor_id, student_id) on mentor_student_links
 * (frozen commission). §2.4's approval gate was intentionally dropped — mentors now
 * self-publish once complete; see src/lib/mentor-publish.ts and docs/spec-coverage.md.
 */

export * from './enums'
export * from './users'
export * from './surveys'
export * from './mentors'
export * from './links'
export * from './sessions'
export * from './trust'
export * from './tasks'
export * from './applications'
export * from './invites'
export * from './availability'
export * from './legal'
export * from './expenses'

/*
 * DEFERRED — spec §4 "Phase 1.5":
 *
 *   subscriptions
 *     id, student_id (fk), mentor_id (fk),
 *     stripe_subscription_id, credits_remaining,
 *     status, current_period_end
 *
 * Not forgotten, deliberately omitted. Its shape depends on the credits-ledger design
 * (§1.5: "no mid-cycle refund of unused credits, cancel stops future billing"), which
 * is genuinely undecided. Shipping a guessed table now buys a migration to fix later.
 */
