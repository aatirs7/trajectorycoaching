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
 * The two people are fixed columns rather than derived from the data. A founder with
 * nothing assigned is a real and useful state ("Isaiah has no open work"), and deriving
 * them would silently drop that person from the page at exactly the moment it matters.
 */
const FOUNDERS = ['Aatir', 'Isaiah'] as const
type Founder = (typeof FOUNDERS)[number]

type Row = typeof tasks.$inferSelect

export default async function TaskOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string }>
}) {
  await requireAdmin()

  const { who } = await searchParams
  const focus = FOUNDERS.find((f) => f === who) ?? null

  const all = await db.select().from(tasks).orderBy(desc(tasks.completedAt))

  const byParent = new Map<string, Row[]>()
  for (const t of all) {
    if (!t.parentId) continue
    byParent.set(t.parentId, [...(byParent.get(t.parentId) ?? []), t])
  }
  const topLevel = all.filter((t) => !t.parentId)

  /**
   * Completion is credited to `completed_by` (who ticked it), falling back to `owner`
   * (whose job it was) for rows finished before that column existed. Those two answer
   * different questions, so the fallback is marked rather than presented as a record.
   */
  const creditedTo = (t: Row) => t.completedBy ?? t.owner

  /** A task is "theirs" if they own it, or it's shared. Shared work belongs to both. */
  const belongsTo = (t: Row, person: Founder) => t.owner === person || t.owner === 'Both'

  /** Everything under a parent, for the counts shown on a workstream row. */
  const kidsOf = (t: Row) => byParent.get(t.id) ?? []

  const completed = topLevel
    .filter((t) => t.status === 'done' && t.completedAt)
    .filter((t) => !focus || creditedTo(t) === focus || kidsOf(t).some((k) => creditedTo(k) === focus))
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())

  const openTop = topLevel
    .filter((t) => t.status !== 'done')
    .filter((t) => !focus || belongsTo(t, focus) || kidsOf(t).some((k) => belongsTo(k, focus)))

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ConsoleHeader
        title="Task overview"
        description="Workstreams, who owns them, and what has actually been finished. Edit on the ops board."
        action={
          <Link
            href="/ops"
            className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
          >
            Go to the ops board
          </Link>
        }
      />

      {/* --------------------------------------------------- founder filter */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {FOUNDERS.map((person) => {
          // Counts are over ALL tasks, parents and children, so a workstream owned by
          // "Both" still credits the individual items inside it.
          const theirs = all.filter((t) => belongsTo(t, person))
          const theirDone = theirs.filter((t) => t.status === 'done').length
          const closed = all.filter((t) => t.status === 'done' && creditedTo(t) === person).length
          const inProgress = theirs.filter((t) => t.status === 'in_progress').length
          const todo = theirs.filter((t) => t.status === 'todo').length
          const pct = theirs.length ? Math.round((theirDone / theirs.length) * 100) : 0
          const active = focus === person

          return (
            <Link
              key={person}
              href={active ? '/ops/overview' : `/ops/overview?who=${person}`}
              aria-pressed={active}
              className="block rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-gold"
            >
              <Card
                className={`h-full p-6 transition-colors ${
                  active ? 'border-gold bg-raised' : 'border-line/20 bg-raised hover:border-gold/50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl">{person}</h2>
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase ${ownerTone(person)}`}
                  >
                    {theirDone}/{theirs.length} done
                  </span>
                </div>

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

                <p className="mt-5 text-xs text-slate">
                  {active ? 'Showing their work — click again to clear.' : `Click to see only ${person}'s work.`}
                </p>
              </Card>
            </Link>
          )
        })}
      </div>

      {focus ? (
        <p className="mt-6 text-center text-sm text-slate">
          Filtered to <span className="text-ink">{focus}</span>.{' '}
          <Link href="/ops/overview" className="underline decoration-gold underline-offset-4">
            Show everyone
          </Link>
        </p>
      ) : null}

      {/* --------------------------------------------------------- completed */}
      <section className="mt-14">
        <h2 className="text-center text-2xl">Completed</h2>
        <p className="mx-auto mt-2 max-w-prose text-center text-sm text-slate">
          Workstreams, newest first. Expand one to see what it covered.
        </p>

        {completed.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate">Nothing completed yet.</p>
        ) : (
          <div className="mx-auto mt-8 max-w-3xl">
            {completed.map((t) => (
              <TaskLine key={t.id} task={t} kids={kidsOf(t)} creditedTo={creditedTo} />
            ))}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------- open */}
      <section className="mt-14">
        <h2 className="text-center text-2xl">Still open</h2>
        <p className="mx-auto mt-2 max-w-prose text-center text-sm text-slate">
          {openTop.length} workstream{openTop.length === 1 ? '' : 's'} outstanding
          {focus ? ` involving ${focus}` : ''}, by area.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {OPS_CATEGORIES.map((category) => {
            const rows = openTop.filter((t) => t.category === category)
            if (rows.length === 0) return null

            return (
              <Card key={category} className="border-line/20 bg-raised p-5">
                <div className="flex items-baseline justify-between gap-3 border-b border-line/12 pb-2">
                  <h3 className="text-lg">{category}</h3>
                  <span className="font-mono text-xs text-slate">{rows.length}</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {rows.map((t) => {
                    const kids = kidsOf(t)
                    const kidsDone = kids.filter((k) => k.status === 'done').length
                    return (
                      <li key={t.id} className="flex items-baseline gap-2.5 text-sm">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${ownerTone(t.owner)}`}
                        >
                          {t.owner}
                        </span>
                        <span className="min-w-0 flex-1">{t.title}</span>
                        {kids.length > 0 ? (
                          <span className="shrink-0 font-mono text-[10px] text-slate tabular-nums">
                            {kidsDone}/{kids.length}
                          </span>
                        ) : t.status !== 'todo' ? (
                          <span className="shrink-0 font-mono text-[10px] tracking-wide text-gold uppercase">
                            {STATUS_LABEL[t.status as OpsStatus]}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })}
        </div>
      </section>
    </main>
  )
}

/**
 * One completed workstream. `<details>` rather than React state so this whole page stays
 * a server component — there is nothing here that needs a client bundle.
 */
function TaskLine({
  task,
  kids,
  creditedTo,
}: {
  task: Row
  kids: Row[]
  creditedTo: (t: Row) => string
}) {
  const date = task.completedAt!.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const summary = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
      <time
        dateTime={task.completedAt!.toISOString()}
        className="w-24 shrink-0 font-mono text-xs text-slate tabular-nums"
      >
        {date}
      </time>
      <span className="min-w-0 flex-1 text-sm">{task.title}</span>
      {kids.length > 0 ? (
        <span className="font-mono text-[10px] text-slate tabular-nums">{kids.length} items</span>
      ) : null}
      <span className="font-mono text-[10px] tracking-wide text-slate uppercase">
        {task.category}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${ownerTone(creditedTo(task))}`}
        title={
          task.completedBy
            ? `Marked done by ${task.completedBy}`
            : `Recorded before completions were attributed — showing the owner, ${task.owner}`
        }
      >
        {creditedTo(task)}
        {task.completedBy ? '' : ' ?'}
      </span>
    </div>
  )

  if (kids.length === 0) {
    return <div className="border-b border-line/12">{summary}</div>
  }

  return (
    <details className="group border-b border-line/12">
      <summary className="cursor-pointer list-none marker:content-none hover:bg-sand/40">
        {summary}
      </summary>
      <ul className="mb-3 ml-24 space-y-1.5 border-l border-line/20 pl-4">
        {kids.map((k) => (
          <li key={k.id} className="flex items-baseline gap-2 text-sm text-slate">
            <span aria-hidden className="text-gold">
              {k.status === 'done' ? '✓' : '·'}
            </span>
            <span className="min-w-0 flex-1">{k.title}</span>
            <span className="shrink-0 font-mono text-[10px] tracking-wide uppercase">
              {creditedTo(k)}
            </span>
          </li>
        ))}
      </ul>
      {task.details ? (
        <p className="mb-4 ml-24 max-w-prose pl-4 text-xs leading-relaxed whitespace-pre-line text-slate">
          {task.details}
        </p>
      ) : null}
    </details>
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
