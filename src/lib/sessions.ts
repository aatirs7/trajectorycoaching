/**
 * Spec §11 — session state machine and the cancellation policy.
 *
 * The timing rule lives here as a PURE function so it can be tested without a clock, a
 * database, or Stripe. Everything else in §11 is a consequence of it.
 *
 * Deliberately NOT marked 'server-only': there are no secrets or I/O here, and the
 * label/tone helpers are used by client components too.
 */

export const CANCELLATION_WINDOW_HOURS = 24

export type SessionStatus =
  | 'paid_unscheduled'
  | 'booked'
  | 'rescheduled'
  | 'completed'
  | 'canceled_free'
  | 'canceled_late'
  | 'refunded'

/** A session that is on the calendar and hasn't happened yet. */
export const UPCOMING_STATUSES = ['paid_unscheduled', 'booked', 'rescheduled'] as const

/**
 * `rescheduled` is really an event, not a state — a rescheduled session is still booked.
 * We keep it because §11 lists it, which means every "is this live?" check has to accept
 * both. Centralized here so that's not re-derived (and mis-derived) per query.
 */
export const SCHEDULED_STATUSES = ['booked', 'rescheduled'] as const

export const TERMINAL_STATUSES = [
  'completed',
  'canceled_free',
  'canceled_late',
  'refunded',
] as const

export function isScheduled(status: SessionStatus): boolean {
  return (SCHEDULED_STATUSES as readonly string[]).includes(status)
}

export function isTerminal(status: SessionStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * Spec §11 — the whole policy, in one place:
 *   - Free reschedule/cancel ≥24h before start.
 *   - Inside 24h: no refund, no credit.
 *   - No-show is treated as a late cancel.
 *
 * Refund eligibility is decided HERE, by us, from timing — never by Calendly. Calendly's
 * cancellation cutoff is set to 24h only so its UX matches; it is not the authority (§9).
 *
 * An unscheduled session (paid, never booked a time) is always refundable: the student
 * paid and got nothing, and there's no held slot to compensate the coach for.
 */
export function refundEligibility(params: {
  scheduledStart: Date | null
  now: Date
}): { refundable: boolean; reason: string } {
  if (!params.scheduledStart) {
    return {
      refundable: true,
      reason: 'Session was never scheduled, so there is no held slot to forfeit.',
    }
  }

  const msUntilStart = params.scheduledStart.getTime() - params.now.getTime()
  const hoursUntilStart = msUntilStart / (1000 * 60 * 60)

  if (hoursUntilStart >= CANCELLATION_WINDOW_HOURS) {
    return {
      refundable: true,
      reason: `Canceled ${Math.floor(hoursUntilStart)}h ahead, at or beyond the ${CANCELLATION_WINDOW_HOURS}h window.`,
    }
  }

  return {
    refundable: false,
    reason: `Canceled ${Math.max(0, Math.floor(hoursUntilStart))}h ahead, inside the ${CANCELLATION_WINDOW_HOURS}h window.`,
  }
}

/**
 * Which status a cancellation lands in.
 *
 * NOTE on `canceled_free` vs `refunded` (§10 and §11 read contradictorily): we treat
 * them as SEQUENTIAL, not alternative. `canceled_free` is the intent recorded at cancel
 * time; `refunded` is the fact, set once Stripe confirms the refund via
 * charge.refunded. Refunds are asynchronous, so there must be a state for
 * "cancel accepted, money not back yet." OPEN QUESTION — flagged for Isaiah.
 */
export function cancellationStatus(refundable: boolean): 'canceled_free' | 'canceled_late' {
  return refundable ? 'canceled_free' : 'canceled_late'
}

/** Can this session still be canceled/rescheduled at all? */
export function canCancel(status: SessionStatus): boolean {
  return !isTerminal(status)
}

export function statusLabel(status: SessionStatus): string {
  switch (status) {
    case 'paid_unscheduled':
      return 'Needs a time'
    case 'booked':
      return 'Booked'
    case 'rescheduled':
      return 'Rescheduled'
    case 'completed':
      return 'Completed'
    case 'canceled_free':
      return 'Canceled — refund pending'
    case 'canceled_late':
      return 'Canceled late'
    case 'refunded':
      return 'Refunded'
  }
}

export function statusTone(status: SessionStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'canceled_late' || status === 'canceled_free' || status === 'refunded') {
    return 'destructive'
  }
  return 'secondary'
}
