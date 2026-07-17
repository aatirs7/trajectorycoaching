import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { ConsoleHeader } from '@/components/console-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'

export const metadata = { title: 'Students' }
export const dynamic = 'force-dynamic'

/** Admin view of students and their onboarding survey. */
export default async function AdminStudentsPage() {
  await requireAdmin()

  const students = await db.query.users.findMany({
    where: eq(users.role, 'student'),
    orderBy: [desc(users.createdAt)],
    limit: 300,
  })

  const surveys = students.length
    ? await db.query.studentSurveys.findMany({
        columns: { userId: true, completedAt: true, careerInterest: true, educationLevel: true },
      })
    : []
  const surveyByUser = new Map(surveys.map((s) => [s.userId, s]))

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <ConsoleHeader title="Students" description="Everyone who signed up as a student, and where they are with the onboarding survey." />

      {students.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate">No students yet.</p>
      ) : (
        <div className="mt-10 space-y-3">
          {students.map((u) => {
            const survey = surveyByUser.get(u.id)
            const done = Boolean(survey?.completedAt)
            return (
              <Card key={u.id} className="border-line/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg leading-snug">{u.fullName ?? 'Unnamed'}</h2>
                    <p className="text-sm text-slate">{u.email}</p>
                    {survey?.careerInterest ? (
                      <p className="mt-1 text-sm text-slate">
                        Interested in {survey.careerInterest}
                        {survey.educationLevel ? ` · ${survey.educationLevel === 'hs' ? 'High school' : 'College'}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={done ? 'default' : 'secondary'}>
                    {done ? 'survey done' : 'no survey'}
                  </Badge>
                </div>
                {done ? (
                  <Link
                    href={`/admin/students/${u.id}`}
                    className="mt-3 inline-block text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
                  >
                    View survey
                  </Link>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
