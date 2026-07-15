import { asc, desc, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { ReportActions } from './report-actions'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { reports, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'

export const metadata = { title: 'Reports' }

/** Spec §12 — admin review queue. Indexed on (status, created_at) for exactly this. */
export default async function AdminReportsPage() {
  await requireAdmin()

  const rows = await db.query.reports.findMany({
    orderBy: [asc(reports.status), desc(reports.createdAt)],
    limit: 200,
  })

  const peopleIds = [...new Set(rows.flatMap((r) => [r.reporterId, r.reportedUserId]))]
  const people = peopleIds.length
    ? await db.query.users.findMany({ where: inArray(users.id, peopleIds) })
    : []
  const byId = new Map(people.map((p) => [p.id, p]))

  const open = rows.filter((r) => r.status === 'open')
  const closed = rows.filter((r) => r.status !== 'open')

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <p className="label-mono">Admin</p>
      <h1 className="mt-3 text-4xl">Reports</h1>

      <section className="mt-10">
        <h2 className="text-2xl">
          Open {open.length > 0 ? <span className="text-slate">({open.length})</span> : null}
        </h2>

        {open.length === 0 ? (
          <p className="mt-3 text-sm text-slate">Nothing open.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {open.map((r) => (
              <ReportRow key={r.id} report={r} byId={byId} />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl">Closed</h2>
          <div className="mt-4 space-y-4">
            {closed.map((r) => (
              <ReportRow key={r.id} report={r} byId={byId} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function ReportRow({
  report,
  byId,
}: {
  report: typeof reports.$inferSelect
  byId: Map<string, typeof users.$inferSelect>
}) {
  const reporter = byId.get(report.reporterId)
  const reported = byId.get(report.reportedUserId)

  return (
    <Card className="border-line/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-mono">{report.category}</p>
          <h3 className="mt-1.5 text-lg leading-snug">
            Against {reported?.fullName ?? reported?.email ?? 'unknown'}
          </h3>
          <p className="text-sm text-slate">
            Filed by {reporter?.fullName ?? reporter?.email ?? 'unknown'} ·{' '}
            {report.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
        </div>
        <Badge variant={report.status === 'open' ? 'destructive' : 'secondary'}>
          {report.status}
        </Badge>
      </div>

      <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-ink/90">
        {report.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        {reported ? (
          <Link href={`/admin/coaches`} className="text-slate underline underline-offset-4">
            Manage this user
          </Link>
        ) : null}
        {report.sessionId ? <span className="text-slate">Session {report.sessionId}</span> : null}
      </div>

      <ReportActions reportId={report.id} status={report.status} />
    </Card>
  )
}
