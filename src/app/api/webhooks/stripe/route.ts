import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/db'
import { coachOfferings, coachProfiles, sessions, users } from '@/db/schema'
import { confirmBookingFromCheckout } from '@/lib/booking'
import { firstName } from '@/lib/cancel'
import { formatPrice } from '@/lib/coach-schema'
import { BookingConfirmedEmail, PaymentReceivedEmail } from '@/lib/email/templates'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'
import { stripe } from '@/lib/stripe'
import { createMeeting, zoomConfigured } from '@/lib/zoom'

/**
 * Spec §8/§10 — Stripe webhooks.
 *
 * This is where a payment becomes a session. checkout.session.completed is the ONLY
 * signal that money actually moved, which is why the sessions row is created here and
 * not optimistically at checkout creation.
 *
 * Idempotency: every handler is safe to run twice, because Stripe retries on any
 * non-2xx and will happily replay an event. The UNIQUE constraint on
 * sessions.stripe_payment_intent_id is the backstop.
 */
export async function POST(req: NextRequest) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.warn('[stripe-webhook] received an event but STRIPE_WEBHOOK_SECRET is not set')
    return new Response('Stripe webhooks not configured', { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature', { status: 400 })

  // The RAW body is required — parsing it first would break signature verification.
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object)
        break

      case 'account.updated':
        await handleAccountUpdated(event.data.object)
        break

      default:
        break
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(`[stripe-webhook] handler failed for ${event.type}`, err)
    // 500 → Stripe retries. Every handler above is idempotent, so a retry is safe.
    return new Response('Handler error', { status: 500 })
  }
}

/** Money landed → create the session at the chosen time, make the Zoom meeting, notify. */
async function handleCheckoutCompleted(checkout: Stripe.Checkout.Session) {
  if (checkout.payment_status !== 'paid') return

  const md = checkout.metadata
  if (!md?.linkId || !md.offeringId || !md.coachId || !md.studentId) {
    console.error(`[stripe-webhook] checkout ${checkout.id} is missing metadata`, md)
    return
  }

  const paymentIntentId =
    typeof checkout.payment_intent === 'string' ? checkout.payment_intent : checkout.payment_intent?.id

  if (!paymentIntentId) {
    console.error(`[stripe-webhook] checkout ${checkout.id} has no payment_intent`)
    return
  }

  // §11 ack — parsed defensively; a missing one is recorded null, never fabricated.
  const ackRaw = md.policyAckAt ? new Date(md.policyAckAt) : null
  const policyAckAt = ackRaw && !Number.isNaN(ackRaw.getTime()) ? ackRaw : null

  const slotStart = parseDate(md.slotStart)
  const slotEnd = parseDate(md.slotEnd)

  const { session, created, booked } = await confirmBookingFromCheckout({
    paymentIntentId,
    amountCents: checkout.amount_total ?? 0,
    linkId: md.linkId,
    offeringId: md.offeringId,
    coachId: md.coachId,
    studentId: md.studentId,
    policyAckAt,
    slotStart,
    slotEnd,
    holdId: md.holdId ?? null,
  })

  // A retry — the session (and any Zoom meeting/emails) already happened.
  if (!created) return

  const [offering, profile, coach, student] = await Promise.all([
    db.query.coachOfferings.findFirst({ where: eq(coachOfferings.id, session.offeringId) }),
    db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, session.coachId) }),
    db.query.users.findFirst({ where: eq(users.id, session.coachId) }),
    db.query.users.findFirst({ where: eq(users.id, session.studentId) }),
  ])
  if (!student) return

  const coachName = coach?.fullName ?? 'your coach'

  // Fallback path: the slot was taken during checkout. Ask the student to pick another.
  if (!booked || !session.scheduledStart) {
    const scheduleUrl = `${env.NEXT_PUBLIC_APP_URL}/coaches/${session.coachId}`
    await notify({
      userId: student.id,
      type: 'payment_received',
      payload: { sessionId: session.id, scheduleUrl },
      email: {
        to: student.email,
        subject: 'Payment received: pick your time',
        react: PaymentReceivedEmail({
          studentName: firstName(student.fullName),
          coachName,
          amount: formatPrice(session.amountCents),
          scheduleUrl,
        }),
      },
    })
    return
  }

  const tz = profile?.timezone ?? 'America/New_York'
  const lengthMinutes = offering?.lengthMinutes ?? 0

  // Create the Zoom meeting — best-effort, never fail the booking over it.
  let joinUrl: string | undefined
  if (zoomConfigured()) {
    try {
      const meeting = await createMeeting({
        topic: `MentorReach session — ${coachName}`,
        startIso: session.scheduledStart.toISOString(),
        durationMin: lengthMinutes,
        timezone: tz,
      })
      await db
        .update(sessions)
        .set({ zoomMeetingId: meeting.id, zoomJoinUrl: meeting.joinUrl, zoomStartUrl: meeting.startUrl })
        .where(eq(sessions.id, session.id))
      joinUrl = meeting.joinUrl
    } catch (err) {
      console.error(`[stripe-webhook] Zoom meeting creation failed for session ${session.id}`, err)
    }
  }

  const startsAt = formatInTz(session.scheduledStart, tz)
  const deadline = formatInTz(new Date(session.scheduledStart.getTime() - 24 * 3600_000), tz)
  const manageUrl = `${env.NEXT_PUBLIC_APP_URL}/sessions`

  // Confirm to both parties. The student sees what they paid; the coach sees their payout.
  await notify({
    userId: student.id,
    type: 'booking_confirmed',
    payload: { sessionId: session.id },
    email: {
      to: student.email,
      subject: `Your session with ${coachName} is booked`,
      react: BookingConfirmedEmail({
        studentName: firstName(student.fullName),
        coachName,
        lengthMinutes,
        startsAt,
        amount: formatPrice(session.amountCents),
        manageUrl,
        cancellationDeadline: deadline,
        joinUrl,
      }),
    },
  })

  if (coach) {
    await notify({
      userId: coach.id,
      type: 'booking_confirmed',
      payload: { sessionId: session.id },
      email: {
        to: coach.email,
        subject: `New session booked with ${student.fullName ?? 'a student'}`,
        react: BookingConfirmedEmail({
          studentName: firstName(coach.fullName),
          coachName: student.fullName ?? 'your student',
          lengthMinutes,
          startsAt,
          amount: formatPrice(session.coachPayoutCents),
          manageUrl,
          cancellationDeadline: deadline,
          joinUrl,
        }),
      },
    })
  }
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

/**
 * Spec §10/§11 — the refund actually settled, so `canceled_free` becomes `refunded`.
 * This is the second half of the sequential pair; see the note in lib/sessions.ts.
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id

  if (!paymentIntentId) return

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.stripePaymentIntentId, paymentIntentId),
  })

  if (!session) return

  // Only a FULL refund closes the session out as refunded.
  if (charge.amount_refunded < charge.amount) return

  await db.update(sessions).set({ status: 'refunded' }).where(eq(sessions.id, session.id))
}

/**
 * Spec §10 — Express onboarding progress.
 *
 * A coach can only be paid once Stripe reports both charges and payouts enabled. We
 * MIRROR that into coach_profiles.stripe_payouts_enabled so the "is this coach live?"
 * check (and the publish checklist) stays a pure DB read — we can't call Stripe per coach
 * inside a browse query. This is also what auto-publishes a coach the moment their Stripe
 * onboarding finishes, with no admin step.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.stripeAccountId, account.id),
  })

  if (!profile) return

  const ready = Boolean(account.charges_enabled && account.payouts_enabled)

  if (ready !== profile.stripePayoutsEnabled) {
    await db
      .update(coachProfiles)
      .set({ stripePayoutsEnabled: ready })
      .where(eq(coachProfiles.id, profile.id))
  }
}
