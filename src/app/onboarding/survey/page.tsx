import { redirect } from 'next/navigation'
import { getMySurvey } from './actions'
import { SurveyForm } from './survey-form'
import { requireUser } from '@/lib/auth/guards'

export const metadata = { title: 'A few questions' }

/**
 * Spec §7 — the mandatory student survey. Hard rule §2.3 gates browse/book on it.
 */
export default async function SurveyPage() {
  const user = await requireUser()

  if (user.role === 'coach') redirect('/coach')
  if (user.role === 'admin') redirect('/admin')

  const existing = await getMySurvey()

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className="text-center">
        <p className="label-mono">Step 2 of 2</p>
        <h1 className="mt-3 text-4xl">Tell us where you&rsquo;re headed</h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
        Ten quick questions. This is how we match you with coaches who&rsquo;ve actually done
          the thing you&rsquo;re trying to do, and it&rsquo;s the last step before you can browse.
        </p>
      </div>

      <SurveyForm
        existing={
          existing
            ? {
                educationLevel: existing.educationLevel,
                gradeYear: existing.gradeYear,
                school: existing.school,
                major: existing.major,
                careerInterest: existing.careerInterest,
                target: existing.target,
                pathCertainty: existing.pathCertainty,
                priorExperience: existing.priorExperience,
                helpWith: existing.helpWith,
                helpWithOther: existing.helpWithOther,
                heardFrom: existing.heardFrom,
              }
            : null
        }
      />
    </main>
  )
}
