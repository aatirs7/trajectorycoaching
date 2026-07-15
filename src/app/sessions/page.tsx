import { desc, eq, inArray, or } from 'drizzle-orm'
import { SessionCard, type SessionView } from './session-card'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachOfferings, sessionNotes, sessions, users } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { isTerminal, type SessionStatus } from '@/lib/sessions'

export const metadata = { title: 'Your sessions' }

/**
 * Spec §12 — the Coaching Sessions dashboard, for BOTH roles: upcoming + past, with
 * status. One page rather than two: the data is the same shape and only the viewer's
 * side of it changes.
 */
export default async function SessionsPage() {
  const user = await requireUser()
  const viewerRole: 'student' | 'coach' = user.role === 'coach' ? 'coach' : 'student'

  const rows = await db.query.sessions.findMany({
    where: or(eq(sessions.studentId, user.id), eq(sessions.coachId, user.id)),
    orderBy: [desc(sessions.scheduledStart), desc(sessions.createdAt)],
  })

  if (rows.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <Header viewerRole={viewerRole} />
        <Card className="mt-10 border-line/20 p-10 text-center">
          <p className="text-lg">No sessions yet.</p>
          <p className="mt-2 text-sm text-slate">
            {viewerRole === 'coach'
              ? 'Once a student books you, it’ll show up here.'
              : 'Browse coaches and book your first session.'}
          </p>
        </Card>
      </main>
    )
  }

  // Batch the lookups rather than N+1-ing per card.
  const counterpartyIds = [
    ...new Set(rows.map((r) => (viewerRole === 'coach' ? r.studentId : r.coachId))),
  ]
  const offeringIds = [...new Set(rows.map((r) => r.offeringId))]
  const sessionIds = rows.map((r) => r.id)

  const [people, offerings, notes] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.id, counterpartyIds) }),
    db.query.coachOfferings.findMany({ where: inArray(coachOfferings.id, offeringIds) }),
    db.query.sessionNotes.findMany({
      where: inArray(sessionNotes.sessionId, sessionIds),
      orderBy: [desc(sessionNotes.createdAt)],
    }),
  ])

  const personById = new Map(people.map((p) => [p.id, p]))
  const offeringById = new Map(offerings.map((o) => [o.id, o]))

  const views: SessionView[] = rows.map((r) => {
    const counterpartyId = viewerRole === 'coach' ? r.studentId : r.coachId
    return {
      id: r.id,
      status: r.status as SessionStatus,
      scheduledStart: r.scheduledStart?.toISOString() ?? null,
      lengthMinutes: offeringById.get(r.offeringId)?.lengthMinutes ?? 0,
      amountCents: r.amountCents,
      payoutCents: r.coachPayoutCents,
      counterpartyName:
        personById.get(counterpartyId)?.fullName ??
        (viewerRole === 'coach' ? 'Your student' : 'Your coach'),
      // The single-use link isn't persisted; /book/complete re-mints it on demand.
      scheduleUrl: r.status === 'paid_unscheduled' ? `/book/complete?session=${r.id}` : null,
      notes: notes
        .filter((n) => n.sessionId === r.id)
        .map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() })),
    }
  })

  const upcoming = views.filter((v) => !isTerminal(v.status))
  const past = views.filter((v) => isTerminal(v.status))

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <Header viewerRole={viewerRole} />

      <section className="mt-10">
        <h2 className="text-2xl">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-slate">Nothing coming up.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {upcoming.map((v) => (
              <SessionCard key={v.id} session={v} viewerRole={viewerRole} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl">Past</h2>
          <div className="mt-4 space-y-4">
            {past.map((v) => (
              <SessionCard key={v.id} session={v} viewerRole={viewerRole} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function Header({ viewerRole }: { viewerRole: 'student' | 'coach' }) {
  return (
    <>
      <p className="label-mono">Coaching sessions</p>
      <h1 className="mt-3 text-4xl">Your sessions</h1>
      <p className="mt-3 text-slate">
        {viewerRole === 'coach'
          ? 'Everything students have booked with you.'
          : 'Everything you’ve booked. Free cancellation up to 24 hours before.'}
      </p>
    </>
  )
}
