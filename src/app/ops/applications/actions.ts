'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { coachApplications } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { firstName } from '@/lib/cancel'
import { createCoachInvite } from '@/lib/coach-invite'
import { CoachInviteEmail, CoachRejectedEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/client'

export type ReviewState = { error?: string; success?: string }

/**
 * Move an application through review. Accept emails the applicant an invite into the
 * existing self-serve setup (they create their account there; setup pre-fills from this
 * application by matching email). Reject optionally sends a polite decline. Emails are
 * best-effort; the status change is the durable record.
 */
export async function reviewApplication(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await requireAdmin()

  const id = String(formData.get('id') ?? '')
  const action = formData.get('action')

  if (!id) return { error: 'Missing application.' }

  const app = await db.query.coachApplications.findFirst({ where: eq(coachApplications.id, id) })
  if (!app) return { error: 'Application not found.' }

  if (action === 'reviewing') {
    await db
      .update(coachApplications)
      .set({ status: 'reviewing', reviewedAt: new Date(), reviewedBy: admin.email })
      .where(eq(coachApplications.id, id))
    revalidatePath('/ops/applications')
    return { success: 'Marked as reviewing.' }
  }

  if (action === 'accept') {
    await db
      .update(coachApplications)
      .set({ status: 'accepted', reviewedAt: new Date(), reviewedBy: admin.email })
      .where(eq(coachApplications.id, id))

    // Mint a tokenized invite (prefilled from the application) — the same /join flow a
    // directly-invited friend gets, instead of a bare /sign-up link.
    const field = app.field === 'Other' ? app.fieldOther : app.field
    const { url } = await createCoachInvite({
      email: app.email,
      fullName: app.fullName,
      prefillField: field ?? null,
      prefillTitle: app.roleCompany,
      invitedBy: admin.id,
    })

    await sendEmail({
      to: app.email,
      subject: 'You’re in — set up your MentorReach coaching profile',
      react: CoachInviteEmail({
        firstName: firstName(app.fullName),
        inviteUrl: url,
        inviterName: admin.fullName ?? undefined,
      }),
    })

    revalidatePath('/ops/applications')
    return { success: `${app.fullName} accepted and invited to set up.` }
  }

  if (action === 'reject') {
    const notify = formData.get('notify') === 'true'

    await db
      .update(coachApplications)
      .set({ status: 'rejected', reviewedAt: new Date(), reviewedBy: admin.email })
      .where(eq(coachApplications.id, id))

    if (notify) {
      await sendEmail({
        to: app.email,
        subject: 'An update on your MentorReach application',
        react: CoachRejectedEmail({ coachName: firstName(app.fullName) }),
      })
    }

    revalidatePath('/ops/applications')
    return { success: `${app.fullName} declined.` }
  }

  return { error: 'Unknown action.' }
}
