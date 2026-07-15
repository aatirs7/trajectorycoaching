'use client'

import Script from 'next/script'
import { useState } from 'react'

/**
 * Spec §8 — "View schedule" opens the coach's embedded Calendly.
 *
 * READ-ONLY PREVIEW, deliberately. This shows availability; it is NOT the booking path.
 * Booking goes payment → single-use link → webhook (§8). A bookable embed here would let
 * a student schedule without paying, producing a Calendly event with no session row to
 * correlate against — exactly the unpaid hold §8 is structured to prevent.
 *
 * Loaded lazily on click so browse traffic doesn't pay for Calendly's script.
 */
export function CalendlyEmbed({ schedulingUrl }: { schedulingUrl: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-lg border border-line/25 px-4 py-2 text-sm transition-colors hover:border-gold"
      >
        View schedule
      </button>
    )
  }

  return (
    <>
      <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
      <div
        className="calendly-inline-widget mt-4 overflow-hidden rounded-xl border border-line/20"
        data-url={`${schedulingUrl}?hide_event_type_details=1&hide_gdpr_banner=1`}
        style={{ minWidth: '320px', height: '620px' }}
      />
      <p className="mt-2 text-xs text-slate">
        This is a preview of availability. Book through the panel so your session is paid and
        tracked.
      </p>
    </>
  )
}
