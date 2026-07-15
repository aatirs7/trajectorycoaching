import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { coachOfferings, coachProfiles, coachStudentLinks, sessions, users } from '@/db/schema'
import { resolveCommission, splitAmount } from './commission'
import { env } from './env'
import { stripe } from './stripe'

/**
 * Spec §8/§10 — the booking sequence.
 *
 *   1. Student picks coach + session length.
 *   2. Stripe Connect payment (§10 destination charge).
 *   3. On success: sessions row as `paid_unscheduled`.
 *   4. Backend mints a single-use Calendly link tagged utm_content=<session_id>.
 *   5. invitee.created webhook matches on that param → `booked`.
 *
 * Payment BEFORE scheduling is deliberate (§8): it guarantees no unpaid holds and gives
 * a clean object to correlate the Calendly booking against.
 */

export class BookingError extends Error {}

/**
 * Spec §6 — get or create the frozen commission relationship for this pair.
 *
 * The freeze happens exactly once, at the first transaction. Every later session reads
 * the stored value; the rate is NEVER recomputed (hard rule §2.2). Note this function
 * reads the existing row first and returns it untouched if present — that, plus
 * UNIQUE(coach_id, student_id), is what makes the freeze real.
 */
export async function getOrCreateLink(params: {
  coachUserId: string
  studentUserId: string
  studentReferredByCoachId: string | null
}) {
  const existing = await db.query.coachStudentLinks.findFirst({
    where: and(
      eq(coachStudentLinks.coachId, params.coachUserId),
      eq(coachStudentLinks.studentId, params.studentUserId),
    ),
  })

  if (existing) return existing

  const { commissionBps, sourcedVia } = resolveCommission({
    coachId: params.coachUserId,
    studentReferredByCoachId: params.studentReferredByCoachId,
  })

  const [created] = await db
    .insert(coachStudentLinks)
    .values({
      coachId: params.coachUserId,
      studentId: params.studentUserId,
      commissionBps,
      sourcedVia,
    })
    /**
     * Two concurrent first-bookings would both miss the SELECT above and both insert.
     * UNIQUE(coach_id, student_id) turns the loser into a no-op rather than an error,
     * and `returning()` hands back the row that won. The rate is identical either way —
     * resolveCommission is pure — so this can't produce a wrong freeze, only a
     * duplicate-key crash if we didn't handle it.
     */
    .onConflictDoNothing({ target: [coachStudentLinks.coachId, coachStudentLinks.studentId] })
    .returning()

  if (created) return created

  const raced = await db.query.coachStudentLinks.findFirst({
    where: and(
      eq(coachStudentLinks.coachId, params.coachUserId),
      eq(coachStudentLinks.studentId, params.studentUserId),
    ),
  })

  if (!raced) throw new BookingError('Could not establish the coach/student relationship.')

  return raced
}

/**
 * Spec §8 step 2 — start checkout for one session.
 *
 * Uses Stripe Checkout with a DESTINATION CHARGE: application_fee_amount is our
 * commission and transfer_data.destination is the coach's Express account, so Stripe
 * routes the payout automatically and keeps our fee (§10).
 *
 * The sessions row is NOT created here. It's created by the checkout.session.completed
 * webhook, which is the only signal that money actually moved — creating it up-front
 * would leave `paid_unscheduled` rows for abandoned checkouts, i.e. sessions that were
 * never paid for, in a status that claims they were.
 */
export async function createCheckout(params: {
  offeringId: string
  studentUserId: string
}): Promise<{ url: string }> {
  const offering = await db.query.coachOfferings.findFirst({
    where: eq(coachOfferings.id, params.offeringId),
  })

  if (!offering || !offering.isActive) {
    throw new BookingError('That session length is no longer offered.')
  }

  const coach = await db.query.users.findFirst({ where: eq(users.id, offering.coachId) })
  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, offering.coachId),
  })

  if (!coach || !profile) throw new BookingError('Coach not found.')

  // Hard rule §2.4 — an unapproved coach is not bookable, enforced at the money path
  // and not only in the browse query.
  if (profile.status !== 'approved') {
    throw new BookingError('This coach is not currently accepting sessions.')
  }

  if (!profile.stripeAccountId) {
    throw new BookingError('This coach has not finished setting up payouts yet.')
  }

  if (!profile.calendlyUserUri) {
    throw new BookingError('This coach has not finished setting up their calendar yet.')
  }

  const student = await db.query.users.findFirst({ where: eq(users.id, params.studentUserId) })
  if (!student) throw new BookingError('Student not found.')

  if (student.id === coach.id) throw new BookingError('You cannot book yourself.')

  // §6: freeze (or read) the commission for this pair BEFORE charging, so the fee we
  // send Stripe is the same value we persist.
  const link = await getOrCreateLink({
    coachUserId: coach.id,
    studentUserId: student.id,
    studentReferredByCoachId: student.referredByCoachId,
  })

  const { commissionCents } = splitAmount(offering.priceCents, link.commissionBps)

  const checkout = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: student.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: offering.priceCents,
          product_data: {
            name: `${offering.lengthMinutes}-minute session with ${coach.fullName ?? 'your coach'}`,
            description: profile.currentTitle,
          },
        },
      },
    ],
    payment_intent_data: {
      // §10 destination charge: Stripe splits the money at capture time.
      application_fee_amount: commissionCents,
      transfer_data: { destination: profile.stripeAccountId },
      metadata: sessionMetadata(link.id, offering.id, coach.id, student.id),
    },
    // Mirrored onto the Checkout Session too — the webhook reads them from here.
    metadata: sessionMetadata(link.id, offering.id, coach.id, student.id),
    success_url: `${env.NEXT_PUBLIC_APP_URL}/book/complete?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/coaches/${coach.id}?canceled=1`,
  })

  if (!checkout.url) throw new BookingError('Stripe did not return a checkout URL.')

  return { url: checkout.url }
}

function sessionMetadata(
  linkId: string,
  offeringId: string,
  coachId: string,
  studentId: string,
): Record<string, string> {
  return { linkId, offeringId, coachId, studentId }
}

/**
 * Spec §8 step 3 — create the session row from a completed checkout.
 *
 * Idempotent by construction: UNIQUE(stripe_payment_intent_id) means a retried webhook
 * (Stripe retries) can't create a second session. onConflictDoNothing + a re-read makes
 * the retry a no-op rather than a 500 that Stripe would then retry again.
 */
export async function createSessionFromCheckout(params: {
  paymentIntentId: string
  amountCents: number
  linkId: string
  offeringId: string
  coachId: string
  studentId: string
}) {
  const link = await db.query.coachStudentLinks.findFirst({
    where: eq(coachStudentLinks.id, params.linkId),
  })

  if (!link) throw new BookingError(`Link ${params.linkId} not found`)

  // Read the FROZEN rate off the link — never recompute it here (§2.2).
  const { commissionCents, coachPayoutCents } = splitAmount(params.amountCents, link.commissionBps)

  const [created] = await db
    .insert(sessions)
    .values({
      coachId: params.coachId,
      studentId: params.studentId,
      offeringId: params.offeringId,
      linkId: params.linkId,
      amountCents: params.amountCents,
      commissionCents,
      coachPayoutCents,
      status: 'paid_unscheduled',
      stripePaymentIntentId: params.paymentIntentId,
    })
    .onConflictDoNothing({ target: sessions.stripePaymentIntentId })
    .returning()

  if (created) return created

  const existing = await db.query.sessions.findFirst({
    where: eq(sessions.stripePaymentIntentId, params.paymentIntentId),
  })

  if (!existing) throw new BookingError('Session row vanished after conflict')

  return existing
}
