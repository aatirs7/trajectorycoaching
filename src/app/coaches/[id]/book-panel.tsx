'use client'

import { useActionState, useState } from 'react'
import { type BookState, startBooking } from './actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatPrice } from '@/lib/coach-schema'

type Offering = { id: string; lengthMinutes: number; priceCents: number }

/**
 * Spec §8 — pick a length, then pay. Payment precedes scheduling, so this panel's job
 * ends at the Stripe redirect; the Calendly step happens after the webhook confirms.
 */
export function BookPanel({
  offerings,
  bookingEnabled,
  disabledReason,
}: {
  offerings: Offering[]
  bookingEnabled: boolean
  disabledReason: string | null
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(startBooking, {})
  const [selected, setSelected] = useState<string>(offerings[0]?.id ?? '')

  return (
    <Card className="border-line/20 p-6">
      <p className="label-mono">Book a session</p>

      <form action={action} className="mt-4">
        <input type="hidden" name="offeringId" value={selected} />

        <div className="space-y-2">
          {offerings.map((o) => {
            const isSelected = selected === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o.id)}
                aria-pressed={isSelected}
                className={`flex w-full items-baseline justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  isSelected ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
                }`}
              >
                <span>{o.lengthMinutes} minutes</span>
                <span className="font-display text-lg">{formatPrice(o.priceCents)}</span>
              </button>
            )
          })}
        </div>

        {disabledReason ? (
          <p className="mt-4 rounded-lg border border-line/20 bg-muted p-3 text-sm text-slate">
            {disabledReason}
          </p>
        ) : null}

        {state.error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="mt-5 w-full"
          disabled={pending || !selected || !bookingEnabled || Boolean(disabledReason)}
        >
          {pending ? 'Starting checkout…' : 'Pay and pick a time'}
        </Button>

        <p className="mt-3 text-center text-xs text-slate">
          You&rsquo;ll choose a time right after payment. Free cancellation up to 24 hours before.
        </p>
      </form>
    </Card>
  )
}
