'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { coachApplications, users } from '@/db/schema'
import { firstName } from '@/lib/cancel'
import { ApplicationReceivedEmail, NewApplicationEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/client'
import { env } from '@/lib/env'
import { applicationSchema } from '@/lib/application-schema'

export type ApplyState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> }

/**
 * Coach application submit (public, no auth). Saves to coach_applications, emails the
 * applicant a confirmation, and notifies the team. Emails are best-effort (they degrade
 * without Resend); the saved row is the durable record.
 */
export async function submitApplication(raw: unknown): Promise<ApplyState> {
  const parsed = applicationSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      error: 'Please check the highlighted answers.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const v = parsed.data

  await db.insert(coachApplications).values({
    fullName: v.fullName,
    email: v.email,
    field: v.field,
    fieldOther: v.fieldOther || null,
    roleCompany: v.roleCompany,
    yearsExperience: v.yearsExperience,
    linkedinUrl: v.linkedinUrl,
    sessionsPerMonth: v.sessionsPerMonth,
    availability: { days: v.days, times: v.times },
    startTiming: v.startTiming,
    startOther: v.startOther || null,
    rate30: v.rate30,
    rate45: v.rate45 || null,
    rate60: v.rate60 || null,
    openToSuggested: v.openToSuggested === 'yes',
    coachingTypes: v.coachingTypes as string[],
    coachingOther: v.coachingOther || null,
    idealStudent: v.idealStudent || null,
    employerConcerns: v.employerConcerns,
    employerConcernNote: v.employerConcernNote || null,
    employerVisibility: v.employerVisibility,
    whyInterested: v.whyInterested,
    priorExperience: v.priorExperience,
    questions: v.questions || null,
    anythingElse: v.anythingElse || null,
  })

  // Confirmation to the applicant (best-effort).
  await sendEmail({
    to: v.email,
    subject: 'We got your Trajectory coach application',
    react: ApplicationReceivedEmail({ firstName: firstName(v.fullName) }),
  })

  // Team notification.
  const admins = await db.query.users.findMany({ where: eq(users.role, 'admin') })
  await Promise.all(
    admins.map((admin) =>
      sendEmail({
        to: admin.email,
        subject: `New coach application: ${v.fullName}`,
        react: NewApplicationEmail({
          fullName: v.fullName,
          field: v.field === 'Other' ? v.fieldOther || 'Other' : v.field,
          roleCompany: v.roleCompany,
          reviewUrl: `${env.NEXT_PUBLIC_APP_URL}/ops/applications`,
        }),
      }),
    ),
  )

  return { ok: true }
}
