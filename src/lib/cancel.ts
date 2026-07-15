import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, users } from '@/db/schema'
import { cancelEvent } from './calendly'
import { SessionCanceledEmail } from './email/templates'
import { notify } from './notifications'
import { cancellationStatus, canCancel, refundEligibility, type SessionStatus } from './sessions'
import { stripe } from './stripe'

/**
 * Spec §10/§11 — cancellation and refund.
 *
 * This is the single implementation of the cancel path. Both entry points route here:
 *   - a student/coach canceling in-app
 *   - Calendly's invitee.canceled webhook
 * so the policy can't drift between them.
 *
 * §10 assumption, UNCONFIRMED WITH ISAIAH (§14.2): on a late cancel / no-show the coach
 * KEEPS the payout — that's the point of the penalty. The student forfeits and the coach
 * is compensated for the held slot. If Isaiah wants it swept back to the platform
 * instead, the change is the `if (refundable)` branch below and nothing else.
 */
export type CancelOutcome = {
  status: SessionStatus
  refunded: boolean
  reason: string
}

export async function cancelSession(params: {
  sessionId: string
  /** Who initiated. 'system' = Calendly webhook echoing a cancel made on their side. */
  actorUserId: string | 'system'
  /** Skip the Calendly API call when Calendly is the one telling US about the cancel. */
  skipCalendly?: boolean
  now?: Date
}): Promise<CancelOutcome> {
  const now = params.now ?? new Date()

  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, params.sessionId) })
  if (!session) throw new Error(`Session ${params.sessionId} not found`)

  // Idempotency: Calendly retries webhooks, and a user can double-click Cancel.
  if (!canCancel(session.status as SessionStatus)) {
    return {
      status: session.status as SessionStatus,
      refunded: session.status === 'refunded',
      reason: 'Session was already closed out.',
    }
  }

  if (params.actorUserId !== 'system') {
    const isParty = params.actorUserId === session.studentId || params.actorUserId === session.coachId
    if (!isParty) throw new Error('Not authorized to cancel this session.')
  }

  // §11: WE decide refund eligibility from timing, not Calendly.
  const { refundable, reason } = refundEligibility({
    scheduledStart: session.scheduledStart,
    now,
  })

  const status = cancellationStatus(refundable)

  await db
    .update(sessions)
    .set({ status, canceledAt: now })
    .where(eq(sessions.id, session.id))

  // Release the coach's slot. Best-effort: our state is already correct, and a Calendly
  // failure must not strand the session in a half-canceled limbo.
  if (!params.skipCalendly && session.calendlyEventUri) {
    try {
      await cancelEvent(session.calendlyEventUri, 'Canceled via Trajectory')
    } catch (err) {
      console.error(`[cancel] Calendly cancel failed for session ${session.id}`, err)
    }
  }

  if (refundable && session.stripePaymentIntentId) {
    try {
      /**
       * refund_application_fee reverses OUR commission and reverse_transfer claws back
       * the coach's payout, so a full refund actually unwinds the destination charge
       * rather than leaving us paying the coach out of pocket (§10).
       */
      await stripe().refunds.create({
        payment_intent: session.stripePaymentIntentId,
        refund_application_fee: true,
        reverse_transfer: true,
        metadata: { sessionId: session.id },
      })
      // Status becomes 'refunded' when charge.refunded confirms — not here. Refunds are
      // async; claiming the money is back before Stripe says so would be a lie to the user.
    } catch (err) {
      console.error(`[cancel] Stripe refund failed for session ${session.id}`, err)
      // Leave it in canceled_free: the refund is owed and visible as pending, rather
      // than silently dropped.
    }
  }

  await notifyBothParties(session, refundable)

  return { status, refunded: refundable, reason }
}

async function notifyBothParties(
  session: typeof sessions.$inferSelect,
  refunded: boolean,
): Promise<void> {
  const [student, coach] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.studentId) }),
    db.query.users.findFirst({ where: eq(users.id, session.coachId) }),
  ])

  if (!student || !coach) return

  const startsAt = session.scheduledStart
    ? session.scheduledStart.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
    : 'an unscheduled slot'

  await Promise.all([
    notify({
      userId: student.id,
      type: 'session_canceled',
      payload: { sessionId: session.id, refunded },
      email: {
        to: student.email,
        subject: 'Your Trajectory session was canceled',
        react: SessionCanceledEmail({
          recipientName: firstName(student.fullName),
          otherPartyName: coach.fullName ?? 'your coach',
          startsAt,
          refunded,
        }),
      },
    }),
    notify({
      userId: coach.id,
      type: 'session_canceled',
      payload: { sessionId: session.id, refunded },
      email: {
        to: coach.email,
        subject: 'A session was canceled',
        react: SessionCanceledEmail({
          recipientName: firstName(coach.fullName),
          otherPartyName: student.fullName ?? 'your student',
          startsAt,
          refunded,
        }),
      },
    }),
  ])
}

export function firstName(fullName: string | null): string {
  return fullName?.split(/\s+/)[0] ?? 'there'
}
