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

  await sendEmail({
    to: email,
    subject: 'You’re invited to coach on MentorReach',
    react: CoachInviteEmail({
      firstName: fullName ? firstName(fullName) : undefined,
      inviteUrl: url,
      inviterName: admin.fullName ?? undefined,
    }),
  })

  revalidatePath('/admin/coaches')
  return { success: `Invite sent to ${email}.`, url }
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
