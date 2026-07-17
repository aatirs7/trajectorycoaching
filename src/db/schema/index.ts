/**
 * Trajectory Coaching — core schema (spec §4).
 *
 * FK CONVENTION: every `coach_id` / `student_id` column in every table references
 * `users.id`, never `coach_profiles.id`. Join to coach_profiles via its `user_id`.
 * See the header comment in ./users.ts.
 *
 * §2.2's hard rule is encoded by UNIQUE(coach_id, student_id) on coach_student_links
 * (frozen commission). §2.4's approval gate was intentionally dropped — coaches now
 * self-publish once complete; see src/lib/coach-publish.ts and docs/spec-coverage.md.
 */

export * from './enums'
export * from './users'
export * from './surveys'
export * from './coaches'
export * from './links'
export * from './sessions'
export * from './trust'
export * from './tasks'
export * from './applications'

/*
 * DEFERRED — spec §4 "Phase 1.5":
 *
 *   subscriptions
 *     id, student_id (fk), coach_id (fk),
 *     stripe_subscription_id, credits_remaining,
 *     status, current_period_end
 *
 * Not forgotten, deliberately omitted. Its shape depends on the credits-ledger design
 * (§1.5: "no mid-cycle refund of unused credits, cancel stops future billing"), which
 * is genuinely undecided. Shipping a guessed table now buys a migration to fix later.
 */
