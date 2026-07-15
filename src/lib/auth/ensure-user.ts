import 'server-only'
import { auth, currentUser } from '@clerk/nextjs/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { Role } from '@/types/globals'
import { clearReferralCookie, readReferralCookie, resolveReferralCode } from './referral'

/**
 * The Clerk → Neon mirror, lazy half.
 *
 * WHY THIS EXISTS ALONGSIDE THE WEBHOOK (src/app/api/webhooks/clerk/route.ts):
 *
 * The webhook alone loses a race that will absolutely happen — Clerk redirects the user
 * into the app the instant signup completes, but `user.created` is a separate HTTP call
 * from Clerk's infrastructure to ours. The first authenticated page load frequently
 * beats it, and every `SELECT … WHERE clerk_id = ?` returns zero rows. It would also
 * make local dev require a tunnel before anyone could sign up on localhost.
 *
 * This function alone fails differently: it's write-once and only fires on an
 * authenticated request, so admin queues can't see a user who hasn't visited, and a
 * role flipped in the Clerk dashboard would never propagate.
 *
 * Together they're safe: UNIQUE(clerk_id) makes the two paths COMMUTATIVE. Whichever
 * arrives first inserts; the other becomes a no-op update. No ordering requirement.
 *
 * Direction is Clerk → Neon, one-way. Clerk is the source of truth; this table is a
 * mirror so we can JOIN/WHERE on role without an API call.
 */
export type DbUser = typeof users.$inferSelect

export async function ensureUser(): Promise<DbUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })

  // Fast path: mirrored, and the referral question is already settled. The webhook keeps
  // email/name/role fresh, so don't pay a Clerk round-trip.
  if (existing?.referredByCoachId) return existing

  const pendingCode = await readReferralCookie()

  // Nothing to do and nothing to bind.
  if (existing && !pendingCode) return existing

  const clerkUser = await currentUser()
  if (!clerkUser) return existing ?? null

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
  if (!email) {
    throw new Error(`Clerk user ${userId} has no email address; cannot mirror to Neon.`)
  }

  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null

  // Role may not be set yet — the user hasn't been through /onboarding/role. Default to
  // 'student' so the NOT NULL column has a value; the picker overwrites it via Clerk,
  // which flows back through the webhook.
  const role = (clerkUser.publicMetadata?.role as Role | undefined) ?? 'student'

  let referredByCoachId: string | null = null
  if (pendingCode) {
    const coachUserId = await resolveReferralCode(pendingCode)
    // A coach cannot refer themselves into their own 20% tier.
    referredByCoachId = coachUserId && coachUserId !== existing?.id ? coachUserId : null
  }

  const [row] = await db
    .insert(users)
    .values({ clerkId: userId, email, fullName, role, referredByCoachId })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email,
        fullName,
        role,
        /**
         * §6 immutability, enforced in SQL rather than by discipline: COALESCE fills the
         * column only when it is still NULL. A later visit with a different cookie — or
         * a webhook that inserted first without one — can never overwrite an established
         * referral.
         */
        referredByCoachId: sql`COALESCE(${users.referredByCoachId}, EXCLUDED.referred_by_coach_id)`,
      },
    })
    .returning()

  // Consume the cookie exactly once so the binding can't be re-attempted later.
  if (pendingCode) await clearReferralCookie()

  return row
}

/** The Neon row for the signed-in user, without the Clerk round-trip or upsert. */
export async function getDbUser(): Promise<DbUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  return (await db.query.users.findFirst({ where: eq(users.clerkId, userId) })) ?? null
}
