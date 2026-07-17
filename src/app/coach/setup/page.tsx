import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { CoachSetupForm, type Prefill } from './setup-form'
import { db } from '@/db'
import { coachApplications, coachOfferings, coachProfiles } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { INDUSTRIES } from '@/lib/coach-schema'

export const metadata = { title: 'Set up your profile' }

/** Coach profile setup. No approval step — the profile publishes itself once complete. */
export default async function CoachSetupPage() {
  const user = await requireUser()

  if (user.role === 'student') redirect('/onboarding/survey')
  if (user.role === 'admin') redirect('/admin')

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, user.id),
  })

  const offerings = await db.query.coachOfferings.findMany({
    where: eq(coachOfferings.coachId, user.id),
  })

  // Pre-fill from an accepted application matching this coach's email (spec: accept
  // invites into setup "with their data pre-filled"). Only when there's no profile yet.
  let prefill: Prefill = null
  if (!profile) {
    const app = await db.query.coachApplications.findFirst({
      where: and(eq(coachApplications.email, user.email), eq(coachApplications.status, 'accepted')),
    })
    if (app) {
      const field = INDUSTRIES.includes(app.field as (typeof INDUSTRIES)[number]) ? app.field : undefined
      prefill = {
        industry: field,
        currentTitle: app.roleCompany,
        displayEmployerGenerally: app.employerVisibility === 'describe_generally',
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className="text-center">
        <p className="label-mono">{profile ? 'Your profile' : 'Get set up'}</p>
        <h1 className="mt-3 text-4xl">
          {profile ? 'Edit your profile' : 'Set up your coaching profile'}
        </h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
          {profile
            ? 'Changes go live immediately.'
            : 'Students see this before they book. Be specific about what you can actually help with.'}
        </p>
      </div>

      <CoachSetupForm
        existing={
          profile
            ? {
                industry: profile.industry,
                currentTitle: profile.currentTitle,
                bio: profile.bio,
                headshotUrl: profile.headshotUrl,
                linkedinUrl: profile.linkedinUrl,
                employerNote: profile.employerNote,
                calendlySchedulingUrl: profile.calendlySchedulingUrl,
                displayEmployerGenerally: profile.displayEmployerGenerally,
                generalTitle: profile.generalTitle,
                handbookSignedName: profile.handbookSignedName,
                handbookSignedAt: profile.handbookAckAt?.toISOString() ?? null,
                offerings: offerings
                  .filter((o) => o.isActive)
                  .map((o) => ({ lengthMinutes: o.lengthMinutes, priceCents: o.priceCents })),
              }
            : null
        }
        prefill={prefill}
      />
    </main>
  )
}
