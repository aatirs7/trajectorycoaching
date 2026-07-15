import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { sessions, users } from '@/db/schema'
import { cancelSession, firstName } from '@/lib/cancel'
import { BookingConfirmedEmail } from '@/lib/email/templates'
import { formatPrice } from '@/lib/coach-schema'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'
import { isScheduled, type SessionStatus } from '@/lib/sessions'

/**
 * Spec §9 — Calendly webhooks.
 *
 * CORRELATION: the single-use scheduling link carries utm_content=<session_id>, and
 * Calendly echoes it back under `payload.tracking.utm_content`. That is the ONLY join
 * key back to our sessions row — everything here depends on it.
 *
 * Events handled:
 *   invitee.created  → booked, store schedule + URIs
 *   invitee.canceled → §11 cancellation logic (canceled_free / canceled_late)
 *
 * Reschedules arrive as a canceled(old) + created(new) pair. See handleCreated.
 */
type CalendlyPayload = {
  event: 'invitee.created' | 'invitee.canceled'
  payload: {
    uri: string
    email: string
    rescheduled?: boolean
    old_invitee?: string | null
    new_invitee?: string | null
    tracking?: { utm_content?: string | null }
    scheduled_event?: {
      uri: string
      start_time: string
      end_time: string
    }
  }
}

export async function POST(req: NextRequest) {
  if (!env.CALENDLY_WEBHOOK_SIGNING_KEY) {
    console.warn('[calendly-webhook] event received but CALENDLY_WEBHOOK_SIGNING_KEY is not set')
    return new Response('Calendly webhooks not configured', { status: 503 })
  }

  const signatureHeader = req.headers.get('calendly-webhook-signature')
  if (!signatureHeader) return new Response('Missing signature', { status: 400 })

  const raw = await req.text()

  if (!verifySignature(raw, signatureHeader, env.CALENDLY_WEBHOOK_SIGNING_KEY)) {
    return new Response('Invalid signature', { status: 400 })
  }

  let body: CalendlyPayload
  try {
    body = JSON.parse(raw) as CalendlyPayload
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const sessionId = body.payload.tracking?.utm_content

  if (!sessionId) {
    // A booking made outside our flow (someone hit the coach's public Calendly directly).
    // Nothing to correlate. Ack so Calendly stops retrying.
    console.warn(`[calendly-webhook] ${body.event} with no utm_content; ignoring`)
    return new Response('ok (no correlation id)', { status: 200 })
  }

  try {
    if (body.event === 'invitee.created') {
      await handleCreated(sessionId, body)
    } else if (body.event === 'invitee.canceled') {
      await handleCanceled(sessionId, body)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(`[calendly-webhook] handler failed for ${body.event}`, err)
    return new Response('Handler error', { status: 500 })
  }
}

/**
 * Calendly signs as: `t=<timestamp>,v1=<hmac>` over `<timestamp>.<raw body>`.
 * Compared with timingSafeEqual — a plain === on an HMAC is a timing oracle.
 */
function verifySignature(raw: string, header: string, key: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, ...rest] = p.split('=')
      return [k.trim(), rest.join('=')]
    }),
  )

  const timestamp = parts.t
  const provided = parts.v1

  if (!timestamp || !provided) return false

  // Reject stale signatures so a captured payload can't be replayed indefinitely.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false

  const expected = crypto.createHmac('sha256', key).update(`${timestamp}.${raw}`).digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(provided, 'utf8')

  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Spec §8 step 5 / §9 — a time was picked. */
async function handleCreated(sessionId: string, body: CalendlyPayload) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })

  if (!session) {
    console.error(`[calendly-webhook] invitee.created for unknown session ${sessionId}`)
    return
  }

  const scheduled = body.payload.scheduled_event
  if (!scheduled) return

  /**
   * A reschedule arrives as canceled(old) + created(new). Calendly flags the new invitee
   * with rescheduled/old_invitee, but the surest signal on our side is that the session
   * was ALREADY scheduled — so a second created event is a move, not a first booking.
   */
  const isReschedule = isScheduled(session.status as SessionStatus) || Boolean(body.payload.old_invitee)

  await db
    .update(sessions)
    .set({
      status: isReschedule ? 'rescheduled' : 'booked',
      scheduledStart: new Date(scheduled.start_time),
      scheduledEnd: new Date(scheduled.end_time),
      calendlyEventUri: scheduled.uri,
      calendlyInviteeUri: body.payload.uri,
    })
    .where(eq(sessions.id, session.id))

  const [student, coach] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.studentId) }),
    db.query.users.findFirst({ where: eq(users.id, session.coachId) }),
  ])

  if (!student || !coach) return

  const startsAt = new Date(scheduled.start_time).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const lengthMinutes = Math.round(
    (new Date(scheduled.end_time).getTime() - new Date(scheduled.start_time).getTime()) / 60000,
  )

  await Promise.all([
    notify({
      userId: student.id,
      type: 'booking_confirmed',
      payload: { sessionId: session.id, startsAt: scheduled.start_time },
      email: {
        to: student.email,
        subject: isReschedule ? 'Your session was rescheduled' : 'Your session is booked',
        react: BookingConfirmedEmail({
          studentName: firstName(student.fullName),
          coachName: coach.fullName ?? 'your coach',
          lengthMinutes,
          startsAt,
          amount: formatPrice(session.amountCents),
          manageUrl: `${env.NEXT_PUBLIC_APP_URL}/sessions`,
        }),
      },
    }),
    notify({
      userId: coach.id,
      type: 'booking_confirmed',
      payload: { sessionId: session.id, startsAt: scheduled.start_time },
      email: {
        to: coach.email,
        subject: isReschedule ? 'A session was rescheduled' : 'New session booked',
        react: BookingConfirmedEmail({
          studentName: firstName(coach.fullName),
          coachName: student.fullName ?? 'your student',
          lengthMinutes,
          startsAt,
          amount: formatPrice(session.coachPayoutCents),
          manageUrl: `${env.NEXT_PUBLIC_APP_URL}/sessions`,
        }),
      },
    }),
  ])
}

/**
 * Spec §9/§11 — canceled in Calendly.
 *
 * A reschedule's cancel half must NOT run the refund logic: the student isn't canceling,
 * they're moving. Calendly marks that invitee `rescheduled: true`, and the paired
 * invitee.created will set the new time.
 */
async function handleCanceled(sessionId: string, body: CalendlyPayload) {
  if (body.payload.rescheduled || body.payload.new_invitee) return

  await cancelSession({
    sessionId,
    actorUserId: 'system',
    // Calendly is telling US about a cancel that already happened on their side —
    // calling their API to cancel it again would be a redundant round-trip at best.
    skipCalendly: true,
  })
}
