'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { sessionNotes, sessions } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { cancelSession } from '@/lib/cancel'

export type ActionState = { error?: string; success?: string }

/** Spec §11 — cancel from the dashboard. Policy lives in lib/cancel.ts, not here. */
export async function cancelSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const sessionId = formData.get('sessionId')
  if (typeof sessionId !== 'string') return { error: 'Missing session.' }

  try {
    // cancelSession authorizes the actor against the session's two parties.
    const outcome = await cancelSession({ sessionId, actorUserId: user.id })

    revalidatePath('/sessions')

    return {
      success: outcome.refunded
        ? 'Session canceled. Your refund is on its way — it usually lands in 5–10 business days.'
        : 'Session canceled. As it was inside the 24-hour window, it is non-refundable.',
    }
  } catch (err) {
    console.error('[sessions] cancel failed', err)
    return { error: err instanceof Error ? err.message : 'Could not cancel that session.' }
  }
}

/** Spec §12 — coach leaves a brief post-session note, visible to that student. */
export async function addSessionNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const sessionId = formData.get('sessionId')
  const body = formData.get('body')

  if (typeof sessionId !== 'string') return { error: 'Missing session.' }
  if (typeof body !== 'string' || !body.trim()) return { error: 'Write something first.' }
  if (body.length > 5000) return { error: 'That note is too long.' }

  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  if (!session) return { error: 'Session not found.' }

  // Only the session's coach may leave notes on it — not the student, not another coach.
  if (session.coachId !== user.id) return { error: 'Only the coach can leave notes.' }

  await db.insert(sessionNotes).values({
    sessionId,
    coachId: user.id,
    body: body.trim(),
  })

  revalidatePath('/sessions')

  return { success: 'Note saved. Your student can see it now.' }
}
