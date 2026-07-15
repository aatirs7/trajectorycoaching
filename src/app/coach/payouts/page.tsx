import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachProfiles } from '@/db/schema'
import { requireCoach } from '@/lib/auth/guards'
import {
  accountPayoutsReady,
  createAccountOnboardingLink,
  createExpressAccount,
  createLoginLink,
  stripeConfigured,
} from '@/lib/stripe'

export const metadata = { title: 'Payouts' }
export const dynamic = 'force-dynamic'

/**
 * Spec §10 — Stripe Connect Express onboarding for a coach.
 *
 * §14.4 is open (self-serve vs. admin-assisted for the first cohort). This builds the
 * SELF-SERVE path, which an admin can also walk a coach through — that's a superset, so
 * either answer is satisfied without a rebuild.
 */
export default async function PayoutsPage() {
  const { user, profile } = await requireCoach()

  if (!stripeConfigured()) {
    return (
      <Shell>
        <Card className="mt-8 border-line/20 p-6">
          <p className="text-sm text-slate">
            Payouts aren&rsquo;t switched on yet — we&rsquo;re still finishing our payment setup.
            Nothing is needed from you right now; we&rsquo;ll email you the moment it&rsquo;s ready.
          </p>
        </Card>
      </Shell>
    )
  }

  // Provision on demand so a coach approved before Stripe existed can still self-serve.
  let accountId = profile.stripeAccountId

  if (!accountId) {
    try {
      accountId = await createExpressAccount({ email: user.email, coachUserId: user.id })
      await db
        .update(coachProfiles)
        .set({ stripeAccountId: accountId })
        .where(eq(coachProfiles.id, profile.id))
    } catch (err) {
      console.error('[payouts] could not create Express account', err)
      return (
        <Shell>
          <Card className="mt-8 border-line/20 p-6">
            <p className="text-sm text-destructive">
              We couldn&rsquo;t start your payout setup just now. Please try again shortly.
            </p>
          </Card>
        </Shell>
      )
    }
  }

  let ready = false
  let actionUrl: string | null = null

  try {
    ready = await accountPayoutsReady(accountId)
    actionUrl = ready
      ? await createLoginLink(accountId)
      : await createAccountOnboardingLink(accountId)
  } catch (err) {
    console.error('[payouts] could not build Stripe link', err)
  }

  return (
    <Shell>
      <Card className="mt-8 border-line/20 p-6">
        {ready ? (
          <>
            <p className="text-lg">You&rsquo;re set up to get paid.</p>
            <p className="mt-2 text-sm text-slate">
              Payouts land automatically after each session — we take our commission at the
              time of the charge, so there&rsquo;s nothing to invoice.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg">One more step before you can be booked.</p>
            <p className="mt-2 text-sm text-slate">
              Stripe handles your payout details — we never see your bank information. It takes
              about two minutes.
            </p>
          </>
        )}

        {actionUrl ? (
          <Button asChild size="lg" className="mt-5">
            <a href={actionUrl}>{ready ? 'View your Stripe dashboard' : 'Set up payouts'}</a>
          </Button>
        ) : (
          <p className="mt-5 text-sm text-destructive">
            We couldn&rsquo;t reach Stripe just now. Please refresh in a moment.
          </p>
        )}
      </Card>

      <Button asChild variant="ghost" className="mt-6 px-0">
        <Link href="/coach">← Back to your coaching</Link>
      </Button>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-14">
      <p className="label-mono">Getting paid</p>
      <h1 className="mt-3 text-4xl">Payouts</h1>
      {children}
    </main>
  )
}
