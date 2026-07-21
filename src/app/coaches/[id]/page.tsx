import { notFound } from 'next/navigation'
import { BookPanel } from './book-panel'
import { CoachAvatar, SpecialtyTags } from '@/components/coach-card'
import { JsonLd } from '@/components/json-ld'
import { Badge } from '@/components/ui/badge'
import { bookingGate } from '@/lib/auth/guards'
import { employerFromTitle, getPublicCoach } from '@/lib/browse'
import { bookingEnabled } from '@/lib/env'
import { NO_INDEX, absoluteUrl } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPublicCoach(id)

  // Not live → the page 404s below, so keep it out of the index either way.
  if (!data) return { title: 'Coach', ...NO_INDEX }

  const name = data.coach.fullName ?? 'Coach'
  /**
   * Cut on a word boundary, not mid-word. A description ending "…helps students bre" is
   * what a truncated slice actually produces, and it is the snippet a search result shows.
   */
  const description = truncate(
    `${data.profile.currentTitle}. ${data.profile.bio}`.replace(/\s+/g, ' ').trim(),
    155,
  )
  const path = `/coaches/${id}`

  return {
    title: `${name} — ${data.profile.industry} coach`,
    description,
    // Absolute canonical, so a profile reached with tracking params still consolidates.
    alternates: { canonical: path },
    openGraph: {
      type: 'profile',
      title: `${name} — ${data.profile.industry} coach`,
      description,
      url: path,
    },
    twitter: { card: 'summary_large_image' as const, title: name, description },
    /**
     * A seed profile is an invented person wearing a real employer's name. It stays
     * browsable so the marketplace can be demoed, but it must never be indexed.
     *
     * Excluding these from the sitemap is not sufficient on its own: a sitemap is a
     * suggestion, and every one of these pages is reachable by a normal link from
     * /coaches. Without this, the first crawl of the browse page finds all of them.
     */
    ...(data.profile.isSeed ? NO_INDEX : {}),
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
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
  }

  const path = absoluteUrl(`/coaches/${id}`)
  const employer = employerFromTitle(profile.currentTitle)

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14">
      {/*
       * Person + Offer is what turns a profile from a blue link into a result carrying a
       * role and a price. Every value here is already rendered on the page for humans —
       * structured data that claims something the page doesn't show is a manual-action
       * risk, not a shortcut.
       *
       * One Offer per active offering rather than a single "from" price, because each
       * session length genuinely is a separate purchasable thing.
       *
       * NOTHING is emitted for a seed profile. The page is noindexed already, but this
       * markup is a different kind of claim: `Person` with a `worksFor` is an explicit,
       * machine-readable statement that a named individual holds a job at a named company.
       * Publishing that about someone who does not exist is worse than a placeholder card,
       * and it costs nothing to withhold.
       */}
      {profile.isSeed ? null : (
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            '@id': `${path}#profilepage`,
            url: path,
            isPartOf: { '@id': absoluteUrl('/#website') },
            mainEntity: {
              '@type': 'Person',
              '@id': `${path}#person`,
              name: coach.fullName ?? 'Coach',
              jobTitle: profile.currentTitle,
              description: profile.bio,
              knowsAbout: profile.specialties,
              ...(employer ? { worksFor: { '@type': 'Organization', name: employer } } : {}),
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${path}#service`,
            serviceType: `${profile.industry} career coaching`,
            provider: { '@id': `${path}#person` },
            areaServed: 'Worldwide',
            offers: offerings.map((o) => ({
              '@type': 'Offer',
              name: `${o.lengthMinutes}-minute coaching session`,
              price: (o.priceCents / 100).toFixed(2),
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
              url: path,
            })),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
              { '@type': 'ListItem', position: 2, name: 'Coaches', item: absoluteUrl('/coaches') },
              { '@type': 'ListItem', position: 3, name: coach.fullName ?? 'Coach', item: path },
            ],
          },
        ]}
      />
      )}

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
