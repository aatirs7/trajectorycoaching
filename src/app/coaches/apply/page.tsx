import { ApplicationForm } from './application-form'

export const metadata = {
  title: 'Coach with MentorReach',
  description:
    'Apply to coach on MentorReach. Share your background, availability, and what you can help students with.',
}

/**
 * Public coach application — the pre-vetting front door. No login; applicants create an
 * account only at profile setup, after they're accepted.
 */
export default function ApplyPage() {
  return (
    <main className="flex-1">
      <ApplicationForm />
    </main>
  )
}
