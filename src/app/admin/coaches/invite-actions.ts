'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { coachInvites } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { firstName } from '@/lib/cancel'
import { createCoachInvite, inviteUrl } from '@/lib/coach-invite'
import { CoachInviteEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/client'

export type InviteState = { error?: string; success?: string; url?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Invite a pre-approved coach directly (no application). Sends the email AND returns the
 *  copyable link, so the admin can share it however they like. */
export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const admin = await requireAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const fullName = String(formData.get('fullName') ?? '').trim() || null

  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  const { url } = await createCoachInvite({
    email,
    fullName,
    invitedBy: admin.id,
  })

  const delivery = await sendEmail({
    to: email,
    subject: 'You’re invited to coach on MentorReach',
    react: CoachInviteEmail({
      firstName: fullName ? firstName(fullName) : undefined,
      inviteUrl: url,
      inviterName: admin.fullName ?? undefined,
    }),
  })

  revalidatePath('/admin/coaches')

  /**
   * Report what actually happened. sendEmail() is best-effort by design and never
   * throws, so claiming "Invite sent" unconditionally is a lie whenever Resend is
   * unconfigured or the send failed — and it's a costly one here, because the admin
   * would stop chasing an invite that never left the building.
   *
   * The invite itself is valid either way: createCoachInvite() has already written the
   * row, and the panel renders the copyable link below this message. So the failure
   * path is genuinely recoverable, which is exactly why it has to be visible.
   */
  if (delivery.sent) return { success: `Invite sent to ${email}.`, url }

  const why =
    delivery.reason === 'not_configured'
      ? 'email isn’t switched on yet'
      : 'the email failed to send'

  return {
    success: `Invite created for ${email}, but ${why}. Copy the link below and send it yourself.`,
    url,
  }
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await db.update(coachInvites).set({ status: 'revoked' }).where(eq(coachInvites.id, id))
  revalidatePath('/admin/coaches')
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const invite = await db.query.coachInvites.findFirst({ where: eq(coachInvites.id, id) })
  if (!invite || invite.status !== 'pending') return

  await sendEmail({
    to: invite.email,
    subject: 'You’re invited to coach on MentorReach',
    react: CoachInviteEmail({
      firstName: invite.fullName ? firstName(invite.fullName) : undefined,
      inviteUrl: inviteUrl(invite.token),
    }),
  })
  revalidatePath('/admin/coaches')
}
