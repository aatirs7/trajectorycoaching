import { desc } from 'drizzle-orm'
import Link from 'next/link'
import { ConsoleHeader } from '@/components/console-shell'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { tasks } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { OPS_CATEGORIES, ownerTone, STATUS_LABEL, type OpsStatus } from '@/lib/ops-schema'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Task overview', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Who is doing what, and what has actually shipped.
 *
 * Read-only by design. Every mutation lives on /ops, so there is exactly one place a task
 * can be edited — two editable views of the same rows is how they drift.
 *
 * The two people are shown as fixed columns rather than derived from the data. A founder
 * with nothing assigned is a real and useful state ("Isaiah has no open work"), and
 * deriving the columns would silently drop them from the page at exactly that moment.
 */
const FOUNDERS = ['Aatir', 'Isaiah'] as const

export default async function TaskOverviewPage() {
  await requireAdmin()

  const all = await db.select().from(tasks).orderBy(desc(tasks.completedAt))

  const done = all.filter((t) => t.status === 'done')
  const open = all.filter((t) => t.status !== 'done')

  /**
   * Completion is credited to `completed_by` (who ticked it), falling back to `owner`
   * (whose job it was) for rows finished before that column existed. Ownership and
   * completion are different questions and this page answers both, so the fallback is
   * labelled rather than silent — see the "assumed" marker in the timeline.
   */
  const creditedTo = (t: (typeof all)[number]) => t.completedBy ?? t.owner

  const recent = done
    .filter((t) => t.completedAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ConsoleHeader
        title="Task overview"
        description="Who owns what, and what has actually been finished. Edit tasks on the ops board."
        action={
          <Link
            href="/ops"
            className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
          >
            Go to the ops board
          </Link>
        }
      />

      {/* ------------------------------------------------------- per-founder */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {FOUNDERS.map((person) => {
          const owned = all.filter((t) => t.owner === person)
          const shared = all.filter((t) => t.owner === 'Both')
          const ownedDone = owned.filter((t) => t.status === 'done').length
          const closed = done.filter((t) => creditedTo(t) === person).length
          const inProgress = owned.filter((t) => t.status === 'in_progress').length
          const todo = owned.filter((t) => t.status === 'todo').length
          const pct = owned.length ? Math.round((ownedDone / owned.length) * 100) : 0

          return (
            <Card key={person} className="border-line/20 bg-raised p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl">{person}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase ${ownerTone(person)}`}
                >
                  {ownedDone}/{owned.length} done
                </span>
              </div>

              {/* A bar reads faster than a fraction when you're comparing two people. */}
              <div
                className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sand-deep"
                role="img"
                aria-label={`${pct}% of ${person}'s tasks complete`}
              >
                <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
                <Stat label="To do" value={todo} />
                <Stat label="In progress" value={inProgress} />
                <Stat label="Closed by them" value={closed} />
              </dl>

              <p className="mt-5 text-xs leading-relaxed text-slate">
                {owned.length === 0
                  ? 'Nothing assigned yet. Assign tasks on the ops board.'
                  : `${shared.length} more task${shared.length === 1 ? '' : 's'} shared as “Both”.`}
              </p>
            </Card>
          )
        })}
      </div>

      {/* --------------------------------------------------------- timeline */}
      <section className="mt-14">
        <h2 className="text-center text-2xl">Completed</h2>
        <p className="mx-auto mt-2 max-w-prose text-center text-sm text-slate">
          Newest first, credited to whoever marked it done.
        </p>

        {recent.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate">Nothing completed yet.</p>
        ) : (
          <ol className="mx-auto mt-8 max-w-3xl">
            {recent.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line/12 py-3"
              >
                <time
                  dateTime={t.completedAt!.toISOString()}
                  className="w-24 shrink-0 font-mono text-xs text-slate tabular-nums"
                >
                  {t.completedAt!.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>

                <span className="min-w-0 flex-1 text-sm">{t.title}</span>

                <span className="font-mono text-[10px] tracking-wide text-slate uppercase">
                  {t.category}
                </span>

                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${ownerTone(creditedTo(t))}`}
                  title={
                    t.completedBy
                      ? `Marked done by ${t.completedBy}`
                      : `Recorded before completions were attributed — showing the owner, ${t.owner}`
                  }
                >
                  {creditedTo(t)}
                  {t.completedBy ? '' : ' ?'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ------------------------------------------------------------- open */}
      <section className="mt-14">
        <h2 className="text-center text-2xl">Still open</h2>
        <p className="mx-auto mt-2 max-w-prose text-center text-sm text-slate">
          {open.length} task{open.length === 1 ? '' : 's'} outstanding, by area.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {OPS_CATEGORIES.map((category) => {
            const rows = open.filter((t) => t.category === category)
            if (rows.length === 0) return null

            return (
              <Card key={category} className="border-line/20 bg-raised p-5">
                <div className="flex items-baseline justify-between gap-3 border-b border-line/12 pb-2">
                  <h3 className="text-lg">{category}</h3>
                  <span className="font-mono text-xs text-slate">{rows.length}</span>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {rows.map((t) => (
                    <li key={t.id} className="flex items-baseline gap-2.5 text-sm">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${ownerTone(t.owner)}`}
                      >
                        {t.owner}
                      </span>
                      <span className="min-w-0 flex-1">{t.title}</span>
                      {t.status !== 'todo' ? (
                        <span className="shrink-0 font-mono text-[10px] tracking-wide text-gold uppercase">
                          {STATUS_LABEL[t.status as OpsStatus]}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="label-mono text-[10px]">{label}</dt>
      <dd className="mt-1 font-display text-2xl tabular-nums">{value}</dd>
    </div>
  )
}
