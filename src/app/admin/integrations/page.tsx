import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth/guards'
import { bookingEnabled, integrationStatus } from '@/lib/env'

export const metadata = { title: 'Integrations' }
export const dynamic = 'force-dynamic'

/**
 * Operational readout: which third-party integrations are actually wired up.
 *
 * This exists because the platform is deliberately built to run WITHOUT these keys —
 * every integration degrades rather than crashing. That's good for development and
 * dangerous at launch, because a missing key looks like a quiet feature gap rather than
 * an error. This page makes the gap loud and checkable.
 */
type Row = {
  name: string
  live: boolean
  envVars: string[]
  whenMissing: string
}

export default async function IntegrationsPage() {
  await requireAdmin()

  const s = integrationStatus()

  const rows: Row[] = [
    {
      name: 'Clerk — webhooks (§3)',
      live: s.clerkWebhook,
      envVars: ['CLERK_WEBHOOK_SIGNING_SECRET'],
      whenMissing:
        'Role/email changes made in the Clerk dashboard won’t reach Neon. Sign-up still works — ensureUser() mirrors a user on their first authenticated request — so this is degraded, not broken.',
    },
    {
      name: 'Stripe — payments (§10)',
      live: s.stripe,
      envVars: ['STRIPE_SECRET_KEY'],
      whenMissing: 'Booking is disabled. Coaches can’t be paid and no session can be created.',
    },
    {
      name: 'Stripe — webhooks',
      live: s.stripeWebhook,
      envVars: ['STRIPE_WEBHOOK_SECRET'],
      whenMissing:
        'Payments would complete but no session row would ever be created — checkout.session.completed is the only signal money moved. Booking is effectively broken without this.',
    },
    {
      name: 'Calendly — scheduling (§9)',
      live: s.calendly,
      envVars: ['CALENDLY_API_TOKEN', 'CALENDLY_ORGANIZATION_URI'],
      whenMissing: 'No single-use scheduling links. Students could pay but never pick a time.',
    },
    {
      name: 'Calendly — webhooks',
      live: s.calendlyWebhook,
      envVars: ['CALENDLY_WEBHOOK_SIGNING_KEY'],
      whenMissing:
        'Sessions would stay “needs a time” forever — invitee.created is what moves them to booked.',
    },
    {
      name: 'Resend — email (§12)',
      live: s.email,
      envVars: ['RESEND_API_KEY', 'EMAIL_FROM'],
      whenMissing: 'No emails send. In-app notifications still work — they’re the durable record.',
    },
    {
      name: 'Cron — session completion (§11)',
      live: s.cron,
      envVars: ['CRON_SECRET'],
      whenMissing:
        'Sessions never move to “completed” after they end, and reminders never send. The endpoint 404s until this is set.',
    },
  ]

  const ready = bookingEnabled() && s.stripeWebhook && s.calendlyWebhook

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <p className="label-mono">Admin</p>
      <h1 className="mt-3 text-4xl">Integrations</h1>
      <p className="mt-3 max-w-prose text-slate">
        Everything here degrades quietly when unconfigured, so the app runs before the
        accounts exist. That&rsquo;s useful in development and hazardous at launch — this page
        is the check.
      </p>

      <Card
        className={`mt-8 border-line/20 p-6 ${ready ? '' : 'border-gold bg-secondary'}`}
      >
        <p className="text-lg">
          {ready
            ? 'End-to-end booking is live.'
            : 'End-to-end booking is NOT live yet.'}
        </p>
        <p className="mt-2 text-sm text-slate">
          {ready
            ? 'Students can pay, schedule, and be reminded.'
            : 'Students can browse, but the Book button is disabled with an explanation rather than an error.'}
        </p>
      </Card>

      <div className="mt-8 space-y-4">
        {rows.map((r) => (
          <Card key={r.name} className="border-line/20 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg leading-snug">{r.name}</h2>
              <Badge variant={r.live ? 'default' : 'secondary'}>
                {r.live ? 'Live' : 'Not configured'}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {r.envVars.map((v) => (
                <code
                  key={v}
                  className="rounded border border-line/20 bg-muted px-2 py-0.5 font-mono text-xs"
                >
                  {v}
                </code>
              ))}
            </div>

            {!r.live ? <p className="mt-3 text-sm text-slate">{r.whenMissing}</p> : null}
          </Card>
        ))}
      </div>

      <p className="mt-8 text-sm text-slate">
        Set these in <code className="font-mono text-xs">.env.local</code> for development and in
        Vercel&rsquo;s environment variables for production. See{' '}
        <code className="font-mono text-xs">.env.example</code>.
      </p>
    </main>
  )
}
