import { asc, desc, inArray } from 'drizzle-orm'
import { PendingActions, StatusActions } from './review-actions'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachOfferings, coachProfiles, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { formatPrice } from '@/lib/coach-schema'

export const metadata = { title: 'Coach approvals' }

/**
 * Spec §12 — the admin approval queue, plus suspend/reinstate.
 *
 * §12 vetting: the LinkedIn URL is surfaced prominently because approving is supposed to
 * involve actually checking the stated employer against it.
 */
export default async function AdminCoachesPage() {
  await requireAdmin()

  const profiles = await db.query.coachProfiles.findMany({
    orderBy: [asc(coachProfiles.status), desc(coachProfiles.createdAt)],
  })

  const coachUsers = profiles.length
    ? await db.query.users.findMany({ where: inArray(users.id, profiles.map((p) => p.userId)) })
    : []

  const offerings = profiles.length
    ? await db.query.coachOfferings.findMany({
        where: inArray(coachOfferings.coachId, profiles.map((p) => p.userId)),
      })
    : []

  const userById = new Map(coachUsers.map((u) => [u.id, u]))

  const pending = profiles.filter((p) => p.status === 'pending')
  const live = profiles.filter((p) => p.status !== 'pending')

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <p className="label-mono">Admin</p>
      <h1 className="mt-3 text-4xl">Coach approvals</h1>
      <p className="mt-3 text-slate">
        Verify each coach&rsquo;s stated employer against their LinkedIn before approving.
        Nobody is bookable until you do.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl">
          Waiting for review{' '}
          {pending.length > 0 ? <span className="text-slate">({pending.length})</span> : null}
        </h2>

        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-slate">Queue is clear.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {pending.map((p) => (
              <CoachRow
                key={p.id}
                profile={p}
                user={userById.get(p.userId)}
                offerings={offerings.filter((o) => o.coachId === p.userId && o.isActive)}
                pendingReview
              />
            ))}
          </div>
        )}
      </section>

      {live.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl">Everyone else</h2>
          <div className="mt-4 space-y-4">
            {live.map((p) => (
              <CoachRow
                key={p.id}
                profile={p}
                user={userById.get(p.userId)}
                offerings={offerings.filter((o) => o.coachId === p.userId && o.isActive)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function CoachRow({
  profile,
  user,
  offerings,
  pendingReview,
}: {
  profile: typeof coachProfiles.$inferSelect
  user?: typeof users.$inferSelect
  offerings: Array<typeof coachOfferings.$inferSelect>
  pendingReview?: boolean
}) {
  return (
    <Card className="border-line/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg leading-snug">{user?.fullName ?? 'Unnamed coach'}</h3>
          <p className="text-sm text-slate">{profile.currentTitle}</p>
          <p className="text-sm text-slate">{user?.email}</p>
        </div>
        <Badge variant={profile.status === 'approved' ? 'default' : 'secondary'}>
          {profile.status}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="label-mono">Field</dt>
          <dd className="mt-0.5">{profile.industry}</dd>
        </div>
        <div>
          <dt className="label-mono">Rates</dt>
          <dd className="mt-0.5">
            {offerings.length
              ? offerings
                  .sort((a, b) => a.lengthMinutes - b.lengthMinutes)
                  .map((o) => `${o.lengthMinutes}m ${formatPrice(o.priceCents)}`)
                  .join(' · ')
              : '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="label-mono">LinkedIn — verify the employer</dt>
          <dd className="mt-0.5">
            <a
              href={profile.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-4"
            >
              {profile.linkedinUrl}
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="label-mono">Bio</p>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink/90">{profile.bio}</p>
      </div>

      {profile.employerNote ? (
        <div className="mt-4">
          <p className="label-mono">Employer note</p>
          <p className="mt-1 text-sm text-slate">{profile.employerNote}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate">
        <span>Stripe: {profile.stripeAccountId ? 'connected' : 'not set up'}</span>
        <span>Calendly: {profile.calendlyUserUri ? 'connected' : 'not set up'}</span>
        <span>Referral code: {profile.referralCode}</span>
      </div>

      {pendingReview ? (
        <PendingActions profileId={profile.id} />
      ) : (
        <StatusActions profileId={profile.id} status={profile.status} />
      )}
    </Card>
  )
}
