import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachOfferings } from '@/db/schema'
import { requireCoach } from '@/lib/auth/guards'
import { formatPrice, INDUSTRIES } from '@/lib/coach-schema'
import { COACH_SOURCED_BPS, PLATFORM_SOURCED_BPS } from '@/lib/commission'
import { env } from '@/lib/env'

export const metadata = { title: 'Your coaching' }

/**
 * The coach's home. Deliberately reachable while `pending` — an unapproved coach still
 * needs to see their status and finish setup (§2.4 makes them unbookable, not locked out).
 */
export default async function CoachHome() {
  const { user, profile } = await requireCoach()

  const offerings = await db.query.coachOfferings.findMany({
    where: eq(coachOfferings.coachId, user.id),
  })

  const active = offerings.filter((o) => o.isActive)
  const referralUrl = `${env.NEXT_PUBLIC_APP_URL}/r/${profile.referralCode}`

  const setupSteps = [
    { done: true, label: 'Profile submitted' },
    { done: profile.status === 'approved', label: 'Approved by our team' },
    { done: Boolean(profile.stripeAccountId), label: 'Payouts connected' },
    { done: Boolean(profile.calendlyUserUri), label: 'Calendar connected' },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <p className="label-mono">Coaching</p>
      <h1 className="mt-3 text-4xl">
        {profile.status === 'approved' ? 'You’re live' : 'Almost there'}
      </h1>

      {profile.status === 'pending' ? (
        <p className="mt-3 max-w-prose text-slate">
          Your profile is with our team for review — we verify every coach&rsquo;s employer
          against their LinkedIn before going live. Usually a couple of days.
        </p>
      ) : profile.status === 'suspended' ? (
        <p className="mt-3 max-w-prose text-slate">
          Your profile isn&rsquo;t currently visible to students. If you think that&rsquo;s a
          mistake, get in touch.
        </p>
      ) : (
        <p className="mt-3 max-w-prose text-slate">
          Students can find and book you. Here&rsquo;s where things stand.
        </p>
      )}

      <Card className="mt-8 border-line/20 p-6">
        <p className="label-mono">Setup</p>
        <ul className="mt-3 space-y-2">
          {setupSteps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`flex size-5 items-center justify-center rounded-full border text-[10px] ${
                  s.done ? 'border-gold bg-gold text-ink' : 'border-line/30 text-slate'
                }`}
              >
                {s.done ? '✓' : ''}
              </span>
              <span className={s.done ? 'text-ink' : 'text-slate'}>{s.label}</span>
            </li>
          ))}
        </ul>

        {!profile.stripeAccountId && profile.status === 'approved' ? (
          <Button asChild size="sm" className="mt-5">
            <Link href="/coach/payouts">Connect payouts</Link>
          </Button>
        ) : null}
      </Card>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card className="border-line/20 p-6">
          <p className="label-mono">Your sessions</p>
          <div className="mt-3 space-y-1.5">
            {active.length ? (
              active
                .sort((a, b) => a.lengthMinutes - b.lengthMinutes)
                .map((o) => (
                  <div key={o.id} className="flex justify-between text-sm">
                    <span className="text-slate">{o.lengthMinutes} minutes</span>
                    <span>{formatPrice(o.priceCents)}</span>
                  </div>
                ))
            ) : (
              <p className="text-sm text-slate">None set up yet.</p>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="mt-5">
            <Link href="/coach/setup">Edit profile &amp; rates</Link>
          </Button>
        </Card>

        <Card className="border-line/20 p-6">
          <p className="label-mono">Your referral link</p>
          <p className="mt-3 text-sm text-slate">
            Students who sign up through this link cost you a lower commission —{' '}
            {PLATFORM_SOURCED_BPS / 100}% drops to {COACH_SOURCED_BPS / 100}% on their sessions
            with you, permanently.
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md border border-line/20 bg-muted px-3 py-2 font-mono text-xs">
            {referralUrl}
          </code>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/sessions">View your sessions</Link>
        </Button>
        {profile.stripeAccountId ? (
          <Button asChild variant="ghost">
            <Link href="/coach/payouts">Payouts</Link>
          </Button>
        ) : null}
      </div>

      <p className="mt-10 text-xs text-slate">
        <Badge variant="secondary" className="mr-2">
          {profile.industry}
        </Badge>
        {INDUSTRIES.includes(profile.industry as never) ? null : 'Custom field'}
      </p>
    </main>
  )
}
