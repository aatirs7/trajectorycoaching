import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachOfferings, coachProfiles, sessions, users } from '@/db/schema'
import { requireStudent } from '@/lib/auth/guards'
import { createSingleUseSchedulingLink, findEventTypeByDuration } from '@/lib/calendly'
import { formatPrice } from '@/lib/coach-schema'

export const metadata = { title: 'Pick your time' }
export const dynamic = 'force-dynamic'

/**
 * Spec §8 step 4 — the student lands here from Stripe and picks a time.
 *
 * The session row is created by the checkout.session.completed webhook, NOT here — a
 * redirect is not proof of payment (a user can hit this URL directly). So this page
 * waits for the webhook rather than trusting the redirect, which is why it can briefly
 * show a "processing" state.
 */
export default async function BookCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ cs?: string; session?: string }>
}) {
  const student = await requireStudent()
  const params = await searchParams

  // Find the session this checkout produced. We deliberately don't trust a session id
  // from the query string beyond scoping it to THIS student's rows.
  const session = params.session
    ? await db.query.sessions.findFirst({ where: eq(sessions.id, params.session) })
    : await db.query.sessions.findFirst({
        where: eq(sessions.studentId, student.id),
        orderBy: [desc(sessions.createdAt)],
      })

  // Authorization: never render someone else's session, even with a valid id.
  if (session && session.studentId !== student.id) {
    return <Problem title="Not found" body="We couldn’t find that session." />
  }

  if (!session) {
    return (
      <Problem
        title="Confirming your payment…"
        body="This usually takes a few seconds. Refresh in a moment — if you were charged, your session is safe and will appear here."
      />
    )
  }

  if (session.status !== 'paid_unscheduled') {
    return (
      <Problem
        title="You're all set"
        body="This session already has a time booked."
        action={{ href: '/sessions', label: 'View your sessions' }}
      />
    )
  }

  const [offering, profile, coach] = await Promise.all([
    db.query.coachOfferings.findFirst({ where: eq(coachOfferings.id, session.offeringId) }),
    db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, session.coachId) }),
    db.query.users.findFirst({ where: eq(users.id, session.coachId) }),
  ])

  // Mint the single-use link on demand. The webhook normally does this and emails it;
  // doing it here too means a Calendly hiccup during the webhook doesn't strand a paid
  // student with no way to schedule.
  let scheduleUrl: string | null = null
  let error: string | null = null

  if (offering && profile?.calendlyUserUri) {
    try {
      const eventType = await findEventTypeByDuration(profile.calendlyUserUri, offering.lengthMinutes)

      if (eventType) {
        scheduleUrl = await createSingleUseSchedulingLink({
          eventTypeUri: eventType.uri,
          sessionId: session.id,
        })
      } else {
        error = 'Your coach hasn’t finished setting up this session length in their calendar.'
      }
    } catch (err) {
      console.error('[book/complete] could not mint scheduling link', err)
      error = 'We couldn’t reach the scheduling system just now.'
    }
  } else {
    error = 'Your coach hasn’t finished setting up their calendar.'
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-20">
      <p className="label-mono">Payment received</p>
      <h1 className="mt-3 text-4xl">One step left — pick your time</h1>
      <p className="mt-3 text-slate">
        You paid {formatPrice(session.amountCents)} for a {offering?.lengthMinutes}-minute session
        with {coach?.fullName ?? 'your coach'}.
      </p>

      <Card className="mt-8 border-line/20 p-6">
        {scheduleUrl ? (
          <>
            <Button asChild size="lg" className="w-full">
              <a href={scheduleUrl}>Choose a time</a>
            </Button>
            <p className="mt-3 text-center text-xs text-slate">
              This link is single-use and tied to this session. We&rsquo;ve emailed it to you too.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <p className="mt-3 text-sm text-slate">
              Your payment is safe and your session is held. We&rsquo;ve been notified — you&rsquo;ll
              get an email with your scheduling link as soon as this is sorted, or you can cancel
              for a full refund since no time was ever booked.
            </p>
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link href="/sessions">View your sessions</Link>
            </Button>
          </>
        )}
      </Card>
    </main>
  )
}

function Problem({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: { href: string; label: string }
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-20">
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-3 text-slate">{body}</p>
      {action ? (
        <Button asChild className="mt-6 self-start">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </main>
  )
}
