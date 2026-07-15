'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { coachProfiles, reports, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import {
  calendlyConfigured,
  findOrgMemberByEmail,
  inviteToOrganization,
} from '@/lib/calendly'
import { firstName } from '@/lib/cancel'
import { CoachApprovedEmail, CoachRejectedEmail } from '@/lib/email/templates'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'
import { createExpressAccount, stripeConfigured } from '@/lib/stripe'

export type AdminState = { error?: string; success?: string }

/**
 * Spec §12 — approve a coach. Hard rule §2.4: this is the ONLY path from pending to
 * approved, and it requires an admin.
 *
 * Side effects are best-effort and individually caught: approval itself must not fail
 * because Calendly or Stripe is unconfigured or down. That also means approval works
 * today, before those accounts exist — the coach just finishes setup later.
 */
export async function approveCoach(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin()

  const profileId = formData.get('profileId')
  if (typeof profileId !== 'string') return { error: 'Missing coach.' }

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.id, profileId),
  })
  if (!profile) return { error: 'Coach not found.' }

  const coach = await db.query.users.findFirst({ where: eq(users.id, profile.userId) })
  if (!coach) return { error: 'Coach user not found.' }

  await db
    .update(coachProfiles)
    .set({ status: 'approved', approvedAt: new Date(), approvedBy: admin.id })
    .where(eq(coachProfiles.id, profile.id))

  const warnings: string[] = []

  // §10 — provision the Express account so the coach has a payouts link to follow.
  if (stripeConfigured() && !profile.stripeAccountId) {
    try {
      const accountId = await createExpressAccount({ email: coach.email, coachUserId: coach.id })
      await db
        .update(coachProfiles)
        .set({ stripeAccountId: accountId })
        .where(eq(coachProfiles.id, profile.id))
    } catch (err) {
      console.error('[admin] Stripe account creation failed', err)
      warnings.push('Stripe account could not be created — the coach can retry from their dashboard.')
    }
  } else if (!stripeConfigured()) {
    warnings.push('Stripe isn’t configured yet, so no payout account was created.')
  }

  // §9 — invite them into the Trajectory Calendly org and capture their host URI.
  if (calendlyConfigured() && !profile.calendlyUserUri) {
    try {
      const member = await findOrgMemberByEmail(coach.email)

      if (member) {
        await db
          .update(coachProfiles)
          .set({ calendlyUserUri: member.uri })
          .where(eq(coachProfiles.id, profile.id))
      } else {
        await inviteToOrganization(coach.email)
        warnings.push('Calendly invitation sent — their host link is captured once they accept.')
      }
    } catch (err) {
      console.error('[admin] Calendly org invite failed', err)
      warnings.push('Calendly invite failed — invite them manually.')
    }
  } else if (!calendlyConfigured()) {
    warnings.push('Calendly isn’t configured yet, so no invitation was sent.')
  }

  await notify({
    userId: coach.id,
    type: 'coach_approved',
    payload: { profileId: profile.id },
    email: {
      to: coach.email,
      subject: 'You’re approved to coach on Trajectory',
      react: CoachApprovedEmail({
        coachName: firstName(coach.fullName),
        payoutsUrl: `${env.NEXT_PUBLIC_APP_URL}/coach/payouts`,
      }),
    },
  })

  revalidatePath('/admin/coaches')

  return {
    success: warnings.length
      ? `${coach.fullName ?? 'Coach'} approved. Note: ${warnings.join(' ')}`
      : `${coach.fullName ?? 'Coach'} approved.`,
  }
}

/** Spec §12 — reject a pending coach. Modeled as suspended: the profile stays for audit. */
export async function rejectCoach(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin()

  const profileId = formData.get('profileId')
  const reason = formData.get('reason')

  if (typeof profileId !== 'string') return { error: 'Missing coach.' }

  const profile = await db.query.coachProfiles.findFirst({ where: eq(coachProfiles.id, profileId) })
  if (!profile) return { error: 'Coach not found.' }

  const coach = await db.query.users.findFirst({ where: eq(users.id, profile.userId) })
  if (!coach) return { error: 'Coach user not found.' }

  await db
    .update(coachProfiles)
    .set({ status: 'suspended' })
    .where(eq(coachProfiles.id, profile.id))

  await notify({
    userId: coach.id,
    type: 'coach_rejected',
    payload: { profileId: profile.id, reason: typeof reason === 'string' ? reason : null },
    email: {
      to: coach.email,
      subject: 'An update on your Trajectory application',
      react: CoachRejectedEmail({
        coachName: firstName(coach.fullName),
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : undefined,
      }),
    },
  })

  revalidatePath('/admin/coaches')

  return { success: `${coach.fullName ?? 'Coach'} was not approved.` }
}

/**
 * Spec §12 — suspend/reinstate. Suspension takes a coach out of browse immediately
 * (browse only returns `approved`) without destroying their session history.
 */
export async function setCoachStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin()

  const profileId = formData.get('profileId')
  const status = formData.get('status')

  if (typeof profileId !== 'string') return { error: 'Missing coach.' }
  if (status !== 'approved' && status !== 'suspended' && status !== 'pending') {
    return { error: 'Invalid status.' }
  }

  await db
    .update(coachProfiles)
    .set({
      status,
      ...(status === 'approved' ? { approvedAt: new Date(), approvedBy: admin.id } : {}),
    })
    .where(eq(coachProfiles.id, profileId))

  revalidatePath('/admin/coaches')

  return { success: `Coach is now ${status}.` }
}

/** Spec §12 — work the report queue. */
export async function setReportStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin()

  const reportId = formData.get('reportId')
  const status = formData.get('status')

  if (typeof reportId !== 'string') return { error: 'Missing report.' }
  if (status !== 'reviewed' && status !== 'actioned' && status !== 'open') {
    return { error: 'Invalid status.' }
  }

  await db
    .update(reports)
    .set({
      status,
      reviewedBy: admin.id,
      reviewedAt: status === 'open' ? null : new Date(),
    })
    .where(eq(reports.id, reportId))

  revalidatePath('/admin/reports')

  return { success: `Report marked ${status}.` }
}
