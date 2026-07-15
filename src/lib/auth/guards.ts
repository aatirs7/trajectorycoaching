import 'server-only'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { coachProfiles, studentSurveys } from '@/db/schema'
import { type DbUser, ensureUser } from './ensure-user'

/**
 * Spec §3 gating, enforced AT THE RESOURCE rather than in proxy.ts.
 *
 * Why not the proxy: the §2.3 survey gate needs a database read, and Clerk explicitly
 * advises against auth checks in middleware. Server Functions are also POSTs to whatever
 * route they live on, so a proxy matcher can silently stop covering them — a guard in
 * the function itself can't be routed around.
 *
 * Each guard calls ensureUser(), which is what makes a brand-new Clerk account work on
 * its very first page load without waiting for the webhook.
 */

/** Signed in, mirrored into Neon. Anything else redirects to sign-in. */
export async function requireUser(): Promise<DbUser> {
  const user = await ensureUser()
  if (!user) redirect('/sign-in')
  return user
}

/**
 * Hard rule §2.3: students are gated behind the survey. No browsing or booking until
 * `completed_at IS NOT NULL` — note this is the gate, NOT mere row existence, which is
 * what lets a partially-filled survey be saved and resumed.
 */
export async function requireStudent(): Promise<DbUser> {
  const user = await requireUser()

  if (user.role === 'admin') return user // admins can inspect student surfaces
  if (user.role !== 'student') redirect('/')

  const survey = await db.query.studentSurveys.findFirst({
    where: eq(studentSurveys.userId, user.id),
    columns: { completedAt: true },
  })

  if (!survey?.completedAt) redirect('/onboarding/survey')

  return user
}

export type CoachContext = { user: DbUser; profile: typeof coachProfiles.$inferSelect }

/**
 * A coach with a profile. Does NOT require approval — a pending coach still needs to
 * reach their own dashboard to see status and finish setup. Use requireApprovedCoach()
 * for anything that implies being bookable.
 */
export async function requireCoach(): Promise<CoachContext> {
  const user = await requireUser()
  if (user.role !== 'coach') redirect('/')

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, user.id),
  })

  if (!profile) redirect('/coach/setup')

  return { user, profile }
}

/** Hard rule §2.4: unapproved coaches are not live. */
export async function requireApprovedCoach(): Promise<CoachContext> {
  const ctx = await requireCoach()
  if (ctx.profile.status !== 'approved') redirect('/coach')
  return ctx
}

export async function requireAdmin(): Promise<DbUser> {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/')
  return user
}

/** Has this student finished the survey? For nav/UI, not for gating. */
export async function hasCompletedSurvey(userId: string): Promise<boolean> {
  const survey = await db.query.studentSurveys.findFirst({
    where: eq(studentSurveys.userId, userId),
    columns: { completedAt: true },
  })
  return Boolean(survey?.completedAt)
}
