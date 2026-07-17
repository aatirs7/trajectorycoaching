import { asc, desc } from 'drizzle-orm'
import { ConsoleHeader } from '@/components/console-shell'
import { ReviewActions } from './review-actions'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachApplications } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'

export const metadata = { title: 'Coach applications' }
export const dynamic = 'force-dynamic'

/**
 * Coach application review — ADMIN ONLY. Unlike the rest of /ops (public), this holds
 * applicant personal data (email, employer, LinkedIn), so it's gated. requireAdmin()
 * redirects non-admins.
 */
export default async function ApplicationsPage() {
  await requireAdmin()

  const apps = await db
    .select()
    .from(coachApplications)
    .orderBy(asc(coachApplications.status), desc(coachApplications.createdAt))

  const open = apps.filter((a) => a.status === 'new' || a.status === 'reviewing')
  const decided = apps.filter((a) => a.status === 'accepted' || a.status === 'rejected')

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <ConsoleHeader
        title="Coach applications"
        description="Review applicants and accept them into setup, or decline."
      />

      <Section title="To review" apps={open} empty="Nothing waiting." />
      {decided.length > 0 ? <Section title="Decided" apps={decided} empty="" /> : null}
    </main>
  )
}

function Section({
  title,
  apps,
  empty,
}: {
  title: string
  apps: Array<typeof coachApplications.$inferSelect>
  empty: string
}) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl">
        {title} {apps.length > 0 ? <span className="text-slate">({apps.length})</span> : null}
      </h2>
      {apps.length === 0 ? (
        <p className="mt-3 text-sm text-slate">{empty}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {apps.map((a) => (
            <ApplicationCard key={a.id} app={a} />
          ))}
        </div>
      )}
    </section>
  )
}

function Row({ q, a }: { q: string; a: string | null | undefined }) {
  if (!a?.toString().trim()) return null
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[1fr_1.6fr] sm:gap-4">
      <dt className="text-xs text-slate uppercase">{q}</dt>
      <dd className="text-sm whitespace-pre-line text-ink/90">{a}</dd>
    </div>
  )
}

function ApplicationCard({ app }: { app: typeof coachApplications.$inferSelect }) {
  const field = app.field === 'Other' ? app.fieldOther || 'Other' : app.field
  const tone =
    app.status === 'accepted' ? 'default' : app.status === 'rejected' ? 'destructive' : 'secondary'

  return (
    <Card className="border-line/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg leading-snug">{app.fullName}</h3>
          <p className="text-sm text-slate">
            {field} · {app.roleCompany}
          </p>
          <p className="text-sm text-slate">
            {app.email} ·{' '}
            {app.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
        </div>
        <Badge variant={tone}>{app.status}</Badge>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink">
          Full application
        </summary>
        <dl className="mt-3 divide-y divide-line/12">
          <Row q="LinkedIn" a={app.linkedinUrl} />
          <Row q="Experience" a={app.yearsExperience} />
          <Row q="Sessions / month" a={app.sessionsPerMonth} />
          <Row q="Availability" a={`Days: ${app.availability.days.join(', ')} · Times: ${app.availability.times.join(', ')}`} />
          <Row q="Start" a={app.startTiming === 'mid_august' ? 'Mid-August' : app.startOther || 'Other'} />
          <Row q="Rates" a={[app.rate30 && `30m ${app.rate30}`, app.rate45 && `45m ${app.rate45}`, app.rate60 && `60m ${app.rate60}`].filter(Boolean).join(' · ')} />
          <Row q="Open to suggested rate" a={app.openToSuggested ? 'Yes' : 'No'} />
          <Row q="Coaching" a={[...app.coachingTypes, app.coachingOther ? `Other: ${app.coachingOther}` : ''].filter(Boolean).join(', ')} />
          <Row q="Ideal student" a={app.idealStudent} />
          <Row q="Employer concerns" a={`${app.employerConcerns}${app.employerConcernNote ? ` — ${app.employerConcernNote}` : ''}`} />
          <Row q="Employer visibility" a={app.employerVisibility === 'show_name' ? "Show employer's name" : 'Describe generally'} />
          <Row q="Why interested" a={app.whyInterested} />
          <Row q="Prior mentoring" a={app.priorExperience} />
          <Row q="Questions" a={app.questions} />
          <Row q="Anything else" a={app.anythingElse} />
          {app.reviewedBy ? <Row q="Reviewed by" a={app.reviewedBy} /> : null}
        </dl>
      </details>

      <ReviewActions id={app.id} status={app.status} />
    </Card>
  )
}
