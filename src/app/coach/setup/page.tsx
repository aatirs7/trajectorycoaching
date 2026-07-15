import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { CoachSetupForm } from './setup-form'
import { db } from '@/db'
import { coachOfferings, coachProfiles } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'

export const metadata = { title: 'Set up your profile' }

/** Spec §5 — coach profile setup. New profiles land in `pending` (§2.4). */
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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <p className="label-mono">{profile ? 'Your profile' : 'Step 2 of 2'}</p>
      <h1 className="mt-3 text-4xl">
        {profile ? 'Edit your profile' : 'Set up your coaching profile'}
      </h1>
      <p className="mt-3 max-w-prose text-slate">
        {profile
          ? 'Changes go live immediately. Your approval status is unaffected.'
          : 'Students see this before they book. Be specific about what you can actually help with.'}
      </p>

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
                offerings: offerings
                  .filter((o) => o.isActive)
                  .map((o) => ({ lengthMinutes: o.lengthMinutes, priceCents: o.priceCents })),
              }
            : null
        }
      />
    </main>
  )
}
