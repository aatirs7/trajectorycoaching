import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachOfferings, reports, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { ConsoleHeader } from '@/components/console-shell'
import { platformStats } from '@/lib/admin-stats'
import { isCoachLive } from '@/lib/coach-publish'
import { formatPrice } from '@/lib/coach-schema'
import { bookingEnabled } from '@/lib/env'

export const metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

/** Admin home — the state of the business at a glance, and the way into everything. */
export default async function AdminHome() {
  await requireAdmin()

  const [profiles, activeOfferings, studentCount, openReports, stats] = await Promise.all([
    db.query.coachProfiles.findMany(),
    db.select({ coachId: coachOfferings.coachId }).from(coachOfferings).where(eq(coachOfferings.isActive, true)),
    db.$count(users, eq(users.role, 'student')),
    db.select({ id: reports.id }).from(reports).where(eq(reports.status, 'open')),
    platformStats(),
  ])

  // Live-coach count via the same rule as browse. Offering presence from the active set.
  const coachesWithOffering = new Set(activeOfferings.map((o) => o.coachId))
  const liveCoaches = profiles.filter((p) =>
    isCoachLive({
      isSeed: p.isSeed,
      status: p.status,
      headshotUrl: p.headshotUrl,
      currentTitle: p.currentTitle,
      bio: p.bio,
      hasActiveOffering: coachesWithOffering.has(p.userId),
      calendlyUserUri: p.calendlyUserUri,
      stripePayoutsEnabled: p.stripePayoutsEnabled,
      handbookAckAt: p.handbookAckAt,
    }),
  ).length
  const signed = profiles.filter((p) => p.handbookAckAt).length

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <ConsoleHeader title="Dashboard" description="The state of the business at a glance." />

      {!bookingEnabled() ? (
        <Card className="mt-8 border-gold bg-secondary p-5">
          <p className="text-sm">
            Booking is not live. Payments and/or scheduling aren&rsquo;t configured.{' '}
            <Link href="/admin/integrations" className="underline underline-offset-4">
              See what&rsquo;s missing
            </Link>
            .
          </p>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Live coaches" value={`${liveCoaches} / ${profiles.length}`} href="/admin/coaches" />
        <Stat label="Students" value={String(studentCount)} href="/admin/students" />
        <Stat label="Agreements signed" value={String(signed)} href="/admin/coaches" />
        <Stat label="Sessions completed" value={String(stats.completed)} href="/admin/coaches" />
        <Stat label="Commission earned" value={formatPrice(stats.commissionCents)} href="/admin/integrations" />
        <Stat label="Open reports" value={String(openReports.length)} href="/admin/reports" />
      </div>

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
