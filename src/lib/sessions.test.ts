import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CANCELLATION_WINDOW_HOURS,
  cancellationStatus,
  canCancel,
  isScheduled,
  isTerminal,
  refundEligibility,
} from './sessions'

const NOW = new Date('2026-07-14T12:00:00Z')
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000)

describe('refundEligibility (spec §11)', () => {
  it('refunds a cancel comfortably outside the window', () => {
    const r = refundEligibility({ scheduledStart: hoursFromNow(72), now: NOW })
    assert.equal(r.refundable, true)
  })

  it('refunds at EXACTLY 24h — the spec says "free ≥24h", inclusive', () => {
    const r = refundEligibility({ scheduledStart: hoursFromNow(CANCELLATION_WINDOW_HOURS), now: NOW })
    assert.equal(r.refundable, true)
  })

  it('does not refund a minute inside the window', () => {
    const justInside = new Date(hoursFromNow(CANCELLATION_WINDOW_HOURS).getTime() - 60_000)
    const r = refundEligibility({ scheduledStart: justInside, now: NOW })
    assert.equal(r.refundable, false)
  })

  it('does not refund an hour before the session', () => {
    const r = refundEligibility({ scheduledStart: hoursFromNow(1), now: NOW })
    assert.equal(r.refundable, false)
  })

  it('does not refund after the session already started (no-show = late cancel)', () => {
    const r = refundEligibility({ scheduledStart: hoursFromNow(-2), now: NOW })
    assert.equal(r.refundable, false)
  })

  it('refunds a paid session that was never scheduled — nothing was held', () => {
    const r = refundEligibility({ scheduledStart: null, now: NOW })
    assert.equal(r.refundable, true)
  })
})

describe('cancellationStatus (spec §11)', () => {
  it('maps refundable to canceled_free and non-refundable to canceled_late', () => {
    assert.equal(cancellationStatus(true), 'canceled_free')
    assert.equal(cancellationStatus(false), 'canceled_late')
  })
})

describe('status helpers', () => {
  it('treats rescheduled as still-scheduled — it is an event, not a state', () => {
    assert.equal(isScheduled('booked'), true)
    assert.equal(isScheduled('rescheduled'), true)
    assert.equal(isScheduled('paid_unscheduled'), false)
  })

  it('knows which statuses are final', () => {
    for (const s of ['completed', 'canceled_free', 'canceled_late', 'refunded'] as const) {
      assert.equal(isTerminal(s), true, s)
      assert.equal(canCancel(s), false, s)
    }
    for (const s of ['paid_unscheduled', 'booked', 'rescheduled'] as const) {
      assert.equal(isTerminal(s), false, s)
      assert.equal(canCancel(s), true, s)
    }
  })
})
