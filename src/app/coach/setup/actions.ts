'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { coachOfferings, coachProfiles } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { generateReferralCode } from '@/lib/auth/referral'
import { coachProfileSchema } from '@/lib/coach-schema'

export type CoachSetupState = {
  errors?: Record<string, string[]>
  message?: string
}

/**
 * Spec §5 — create or update a coach profile.
 *
 * Hard rule §2.4: status is NOT set here. It defaults to 'pending' in the database, and
 * only an admin can move it. An edit by an approved coach does not reset that — see the
 * explicit column list in the update below.
 */
export async function saveCoachProfile(
  _prev: CoachSetupState,
  formData: FormData,
): Promise<CoachSetupState> {
  const user = await requireUser()

  if (user.role !== 'coach') {
    return { message: 'Only coaches can set up a coaching profile.' }
  }

  // Offerings arrive as parallel arrays: a checked length + its price input.
  const lengths = formData.getAll('lengthMinutes').map(String)
  const offerings = lengths
    .map((len) => ({
      lengthMinutes: len,
      priceCents: formData.get(`price_${len}`),
    }))
    .filter((o) => o.priceCents !== null && o.priceCents !== '')

  const parsed = coachProfileSchema.safeParse({
    industry: formData.get('industry'),
    currentTitle: formData.get('currentTitle'),
    bio: formData.get('bio'),
    headshotUrl: formData.get('headshotUrl') ?? '',
    linkedinUrl: formData.get('linkedinUrl'),
    employerNote: formData.get('employerNote') ?? '',
    offerings,
  })

  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return {
      errors: {
        ...(flat.fieldErrors as Record<string, string[]>),
        ...(flat.formErrors.length ? { _form: flat.formErrors } : {}),
      },
      message: 'Please fix the highlighted fields.',
    }
  }

  const v = parsed.data
  const existing = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, user.id),
  })

  const profileValues = {
    industry: v.industry,
    currentTitle: v.currentTitle,
    bio: v.bio,
    headshotUrl: v.headshotUrl || null,
    linkedinUrl: v.linkedinUrl,
    employerNote: v.employerNote || null,
  }

  if (existing) {
    // Note the explicit column list: status, approvedAt, approvedBy and referralCode are
    // deliberately absent so a profile edit can never launder an unapproved coach into
    // an approved one, or churn a referral code that's already been shared.
    await db.update(coachProfiles).set(profileValues).where(eq(coachProfiles.id, existing.id))
  } else {
    await db.insert(coachProfiles).values({
      ...profileValues,
      userId: user.id,
      referralCode: await uniqueReferralCode(user.fullName),
      // status intentionally omitted — the DB default ('pending') is hard rule §2.4.
    })
  }

  await syncOfferings(user.id, v.offerings)

  redirect('/coach')
}

/**
 * Offerings are soft-deleted, never removed: sessions.offering_id references them with
 * onDelete: 'restrict', so a hard delete would either fail or orphan session history.
 */
async function syncOfferings(
  coachUserId: string,
  desired: Array<{ lengthMinutes: number; priceCents: number }>,
) {
  const current = await db.query.coachOfferings.findMany({
    where: eq(coachOfferings.coachId, coachUserId),
  })

  const desiredLengths = desired.map((d) => d.lengthMinutes)

  for (const d of desired) {
    const match = current.find((c) => c.lengthMinutes === d.lengthMinutes)

    if (match) {
      await db
        .update(coachOfferings)
        .set({ priceCents: d.priceCents, isActive: true })
        .where(eq(coachOfferings.id, match.id))
    } else {
      await db.insert(coachOfferings).values({
        coachId: coachUserId,
        lengthMinutes: d.lengthMinutes,
        priceCents: d.priceCents,
      })
    }
  }

  const toRetire = current
    .filter((c) => !desiredLengths.includes(c.lengthMinutes) && c.isActive)
    .map((c) => c.id)

  if (toRetire.length) {
    await db
      .update(coachOfferings)
      .set({ isActive: false })
      .where(and(inArray(coachOfferings.id, toRetire), eq(coachOfferings.coachId, coachUserId)))
  }
}

/** referral_code is UNIQUE; retry on the astronomically unlikely collision. */
async function uniqueReferralCode(fullName: string | null): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(fullName)
    const taken = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.referralCode, code),
      columns: { id: true },
    })
    if (!taken) return code
  }
  throw new Error('Could not generate a unique referral code after 5 attempts')
}
