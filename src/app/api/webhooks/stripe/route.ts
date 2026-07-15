import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/db'
import { coachOfferings, coachProfiles, sessions, users } from '@/db/schema'
import { createSessionFromCheckout } from '@/lib/booking'
import { createSingleUseSchedulingLink, findEventTypeByDuration } from '@/lib/calendly'
import { firstName } from '@/lib/cancel'
import { formatPrice } from '@/lib/coach-schema'
import { PaymentReceivedEmail } from '@/lib/email/templates'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'
import { stripe } from '@/lib/stripe'

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

/** Spec §8 steps 2→3: money landed, so create the session and mint the Calendly link. */
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

  const session = await createSessionFromCheckout({
    paymentIntentId,
    amountCents: checkout.amount_total ?? 0,
    linkId: md.linkId,
    offeringId: md.offeringId,
    coachId: md.coachId,
    studentId: md.studentId,
  })

  // Already had a scheduling link (this is a retry) — don't mint a second one.
  if (session.calendlyEventUri) return

  await mintSchedulingLink(session.id)
}

/**
 * Spec §8 steps 3→4 — the single-use Calendly link.
 *
 * Best-effort by design: if Calendly is down or unconfigured, the session still exists
 * as `paid_unscheduled` and /book/complete can mint the link on demand. Throwing here
 * would make Stripe retry the whole webhook and risk duplicate work for a failure that
 * has nothing to do with the payment.
 */
async function mintSchedulingLink(sessionId: string) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  if (!session) return

  const [offering, profile, coach, student] = await Promise.all([
    db.query.coachOfferings.findFirst({ where: eq(coachOfferings.id, session.offeringId) }),
    db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, session.coachId) }),
    db.query.users.findFirst({ where: eq(users.id, session.coachId) }),
    db.query.users.findFirst({ where: eq(users.id, session.studentId) }),
  ])

  if (!offering || !profile?.calendlyUserUri || !student) return

  let scheduleUrl = `${env.NEXT_PUBLIC_APP_URL}/book/complete?session=${session.id}`

  try {
    const eventType = await findEventTypeByDuration(profile.calendlyUserUri, offering.lengthMinutes)

    if (eventType) {
      // utm_content=<session_id> is the join key invitee.created echoes back (§9).
      scheduleUrl = await createSingleUseSchedulingLink({
        eventTypeUri: eventType.uri,
        sessionId: session.id,
      })
    } else {
      console.error(
        `[stripe-webhook] no ${offering.lengthMinutes}min Calendly event type for coach ${session.coachId}`,
      )
    }
  } catch (err) {
    console.error(`[stripe-webhook] could not mint Calendly link for session ${session.id}`, err)
  }

  await notify({
    userId: student.id,
    type: 'payment_received',
    payload: { sessionId: session.id, scheduleUrl },
    email: {
      to: student.email,
      subject: 'Payment received — pick your time',
      react: PaymentReceivedEmail({
        studentName: firstName(student.fullName),
        coachName: coach?.fullName ?? 'your coach',
        amount: formatPrice(session.amountCents),
        scheduleUrl,
      }),
    },
  })
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
 * Spec §10 — Express onboarding progress. A coach is only bookable once Stripe says
 * charges and payouts are enabled; this keeps our view of that current.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.stripeAccountId, account.id),
  })

  if (!profile) return

  console.info(
    `[stripe-webhook] account ${account.id} charges=${account.charges_enabled} payouts=${account.payouts_enabled}`,
  )
}
