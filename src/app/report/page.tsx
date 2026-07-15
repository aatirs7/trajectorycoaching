import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ReportForm } from './report-form'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'

export const metadata = { title: 'Report a problem' }

/** Spec §12 — /report?user=<id>&session=<id> */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; session?: string }>
}) {
  await requireUser()

  const params = await searchParams
  if (!params.user) notFound()

  const reported = await db.query.users.findFirst({ where: eq(users.id, params.user) })
  if (!reported) notFound()

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-14">
      <div className="text-center">
        <p className="label-mono">Trust &amp; safety</p>
        <h1 className="mt-3 text-4xl">Report a problem</h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
        This goes straight to our team. We read every report, and we&rsquo;ll never share
          your name with the person you&rsquo;re reporting.
        </p>
      </div>

      <ReportForm
        reportedUserId={reported.id}
        reportedName={reported.fullName ?? 'this user'}
        sessionId={params.session}
      />
    </main>
  )
}
