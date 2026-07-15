import { eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachProfiles, reports, sessions } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { formatPrice } from '@/lib/coach-schema'
import { bookingEnabled } from '@/lib/env'

export const metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

/** Spec §12 — admin home: what needs attention. */
export default async function AdminHome() {
  await requireAdmin()

  const [pendingCoaches, openReports, allSessions] = await Promise.all([
    db.select({ id: coachProfiles.id }).from(coachProfiles).where(eq(coachProfiles.status, 'pending')),
    db.select({ id: reports.id }).from(reports).where(eq(reports.status, 'open')),
    db
      .select({ commissionCents: sessions.commissionCents, status: sessions.status })
      .from(sessions)
      .where(inArray(sessions.status, ['booked', 'rescheduled', 'completed'])),
  ])

  // Commission on sessions that weren't refunded — i.e. revenue we actually kept.
  const grossCommission = allSessions.reduce((sum, s) => sum + s.commissionCents, 0)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <p className="label-mono">Admin</p>
      <h1 className="mt-3 text-4xl">Control room</h1>

      {!bookingEnabled() ? (
        <Card className="mt-8 border-gold bg-secondary p-5">
          <p className="text-sm">
            Booking is not live — payments and/or scheduling aren&rsquo;t configured.{' '}
            <Link href="/admin/integrations" className="underline underline-offset-4">
              See what&rsquo;s missing
            </Link>
            .
          </p>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <Stat label="Coaches awaiting review" value={String(pendingCoaches.length)} href="/admin/coaches" />
        <Stat label="Open reports" value={String(openReports.length)} href="/admin/reports" />
        <Stat label="Commission booked" value={formatPrice(grossCommission)} href="/admin/integrations" />
      </div>

      <nav className="mt-10 space-y-3">
        <AdminLink href="/admin/coaches" title="Coach approvals" blurb="Verify employers, approve, suspend." />
        <AdminLink href="/admin/reports" title="Reports" blurb="Trust & safety queue." />
        <AdminLink href="/admin/integrations" title="Integrations" blurb="Which third-party keys are wired up." />
      </nav>
    </main>
  )
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="border-line/20 p-5 transition-colors hover:border-gold">
        <p className="label-mono">{label}</p>
        <p className="mt-2 font-display text-3xl">{value}</p>
      </Card>
    </Link>
  )
}

function AdminLink({ href, title, blurb }: { href: string; title: string; blurb: string }) {
  return (
    <Link href={href} className="block">
      <Card className="border-line/20 p-5 transition-colors hover:border-gold">
        <h2 className="text-lg">{title}</h2>
        <p className="mt-1 text-sm text-slate">{blurb}</p>
      </Card>
    </Link>
  )
}
