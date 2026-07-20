import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { studentSurveys, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { PATH_CERTAINTY_LABELS } from '@/lib/survey-schema'

export const metadata = { title: 'Student survey' }
export const dynamic = 'force-dynamic'

/** Full onboarding-survey responses for one student (spec §7). */
export default async function AdminStudentDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [student, survey] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, id) }),
    db.query.studentSurveys.findFirst({ where: eq(studentSurveys.userId, id) }),
  ])

  if (!student || !survey) notFound()

  const helpWith = [...survey.helpWith, ...(survey.helpWithOther ? [`Other: ${survey.helpWithOther}`] : [])]

  const rows: Array<{ q: string; a: string | null }> = [
    { q: 'High school or college', a: survey.educationLevel === 'hs' ? 'High school' : 'College' },
    { q: 'Grade / year', a: survey.gradeYear },
    { q: 'School', a: survey.school },
    { q: 'Major', a: survey.major },
    { q: 'Field or career interest', a: survey.careerInterest },
    { q: 'Specific company / industry / role', a: survey.target },
    { q: 'How set on that path', a: PATH_CERTAINTY_LABELS[survey.pathCertainty] ?? String(survey.pathCertainty) },
    { q: 'Prior experience', a: survey.priorExperience },
    { q: 'Wants help with', a: helpWith.length ? helpWith.join(', ') : null },
    { q: 'How they heard about MentorReach', a: survey.heardFrom },
  ]

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14">
      <Link
        href="/admin/students"
        className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
      >
        ← All students
      </Link>

      <div className="mt-6">
        <h1 className="text-4xl leading-tight">{student.fullName ?? 'Unnamed'}</h1>
        <p className="mt-1 text-sm text-slate">{student.email}</p>
        {survey.completedAt ? (
          <p className="mt-1 text-sm text-slate">
            Completed {survey.completedAt.toLocaleDateString('en-US', { dateStyle: 'long' })}
          </p>
        ) : null}
      </div>

      <Card className="mt-8 border-line/20 p-6">
        <dl className="divide-y divide-line/12">
          {rows.map((r) => (
            <div key={r.q} className="grid gap-1 py-3.5 sm:grid-cols-[1fr_1.4fr] sm:gap-4">
              <dt className="text-sm text-slate">{r.q}</dt>
              <dd className="text-sm whitespace-pre-line text-ink/90">
                {r.a?.trim() ? r.a : <span className="text-slate">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </main>
  )
}
