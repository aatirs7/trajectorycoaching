import { notFound } from 'next/navigation'
import { BookPanel } from './book-panel'
import { CalendlyEmbed } from './calendly-embed'
import { CoachAvatar, SpecialtyTags } from '@/components/coach-card'
import { Badge } from '@/components/ui/badge'
import { bookingGate } from '@/lib/auth/guards'
import { getPublicCoach } from '@/lib/browse'
import { bookingEnabled } from '@/lib/env'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPublicCoach(id)

  if (!data) return { title: 'Coach' }

  return {
    title: data.coach.fullName ?? 'Coach',
    description: `${data.profile.currentTitle}. ${data.profile.bio.slice(0, 140)}`,
  }
}

/**
 * Spec §8 — coach profile: full bio, background, what they help with, rates, and the
 * booking action.
 *
 * PUBLIC (see the note in ../page.tsx): anyone can read it, only a signed-in student
 * with a completed survey can book. bookingGate() computes which, so the panel can say
 * what's needed rather than bouncing a stranger to a sign-in wall.
 *
 * getPublicCoach() returns null for anyone not `approved`, so an unapproved coach's page
 * 404s rather than being quietly viewable by URL (§2.4).
 */
export default async function CoachProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [data, gate] = await Promise.all([getPublicCoach(id), bookingGate()])

  if (!data) notFound()

  const { profile, coach, offerings } = data
  const enabled = bookingEnabled()

  // Tell the student the truth about why they can't book, rather than letting them hit
  // an error at checkout.
  let disabledReason: string | null = null
  if (!enabled) {
    disabledReason = 'Booking is being switched on shortly. Nothing here will charge you yet.'
  } else if (!profile.stripeAccountId) {
    disabledReason = 'This coach is still setting up payouts and can’t take bookings yet.'
  } else if (!profile.calendlyUserUri) {
    disabledReason = 'This coach is still setting up their calendar and can’t take bookings yet.'
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
      <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex items-start gap-5">
            {/* Goes through resolveHeadshot(): a real profile can never show a fake face. */}
            <CoachAvatar
              coach={{
                fullName: coach.fullName,
                headshotUrl: profile.headshotUrl,
                isSeed: profile.isSeed,
              }}
              size={88}
              className="text-3xl"
            />

            <div>
              <h1 className="text-4xl leading-tight">{coach.fullName ?? 'Coach'}</h1>
              <p className="mt-1 text-lg text-slate">
                {profile.displayEmployerGenerally && profile.generalTitle
                  ? profile.generalTitle
                  : profile.currentTitle}
              </p>
              <Badge
                variant="secondary"
                className="mt-3 font-mono text-[11px] tracking-wider uppercase"
              >
                {profile.industry}
              </Badge>
              <SpecialtyTags specialties={profile.specialties} max={5} />
            </div>
          </div>

          <section className="mt-10 border-t border-line/15 pt-8">
            <h2 className="text-xl">About</h2>
            <p className="mt-3 max-w-prose leading-relaxed whitespace-pre-line text-ink/90">
              {profile.bio}
            </p>
          </section>

          {profile.employerNote ? (
            <section className="mt-8 border-t border-line/15 pt-8">
              <h2 className="text-xl">A note on their employer</h2>
              <p className="mt-3 max-w-prose leading-relaxed text-slate">{profile.employerNote}</p>
            </section>
          ) : null}

          {profile.calendlySchedulingUrl ? (
            <section className="mt-8 border-t border-line/15 pt-8">
              <h2 className="text-xl">Their availability</h2>
              <p className="mt-2 max-w-prose text-sm text-slate">
                A preview of when they&rsquo;re free. You&rsquo;ll get a private link to actually
                book after payment.
              </p>
              <CalendlyEmbed schedulingUrl={profile.calendlySchedulingUrl} />
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <BookPanel
            offerings={offerings.map((o) => ({
              id: o.id,
              lengthMinutes: o.lengthMinutes,
              priceCents: o.priceCents,
            }))}
            bookingEnabled={enabled}
            disabledReason={disabledReason}
            gate={gate}
          />
        </aside>
      </div>
    </main>
  )
}
