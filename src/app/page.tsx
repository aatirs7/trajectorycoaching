import Image from 'next/image'
import Link from 'next/link'
import { CoachCard } from '@/components/coach-card'
import { Button } from '@/components/ui/button'
import { getDbUser } from '@/lib/auth/ensure-user'
import { browseCoaches, listIndustries, rosterEmployers } from '@/lib/browse'
import { TRUST_BLOCK_BODY, TRUST_BLOCK_TITLE } from '@/lib/policy-copy'

/**
 * Spec §1 — the homepage. Warm, editorial, generous whitespace, no heavy shadows.
 *
 * SECTION RHYTHM. Tones alternate the whole way down so the page has a pulse as you
 * scroll, rather than reading as one flat ivory template:
 *
 *   hero          sand        (a step down from paper)
 *   coaches       paper       + raised cards
 *   coach CTA     INK         full-bleed, the anchor contrast moment
 *   trust         sand-deep
 *   footer        ink
 *
 * No two adjacent sections share a tone. That's also why the coach CTA sits ABOVE the
 * trust band rather than last: the footer is ink, so a full-bleed ink CTA immediately
 * before it would merge into one undifferentiated dark mass. The trust band between them
 * both keeps the alternation honest and closes the page on a reassurance.
 *
 * Depth comes from those blocks, not shadows (§1).
 */
export default async function Home() {
  const user = await getDbUser()

  const [featured, industries, employers] = await Promise.all([
    browseCoaches().then((c) => c.slice(0, 6)),
    listIndustries(),
    rosterEmployers(),
  ])

  const ctaHref = user ? (user.role === 'coach' ? '/coach' : '/coaches') : '/coaches'

  return (
    <main className="flex-1">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden border-b border-line/15 bg-sand">
        {/* Warm gold wash: a soft light source, not a shadow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
        />

        <div className="relative mx-auto grid w-full max-w-5xl gap-14 px-6 pt-24 pb-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="label-mono flex items-center gap-2">
              <span className="inline-block h-px w-8 bg-gold" />
              Career coaching, honestly
            </p>

            <h1 className="text-hero mt-6">
              Own your <span className="italic text-line">trajectory</span>.
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-relaxed text-slate">
              Book time with people who already have the job you want. No mentorship theater
              and no generic advice. Just a real conversation with someone who did the thing
              you&rsquo;re trying to do.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={ctaHref}>{user ? 'Go to your dashboard' : 'Find a coach'}</Link>
              </Button>
              {!user ? (
                <Button asChild size="lg" variant="outline">
                  <Link href="/sign-up">Coach on Trajectory</Link>
                </Button>
              ) : null}
            </div>

            {industries.length > 0 ? (
              <div className="mt-10 border-t border-line/15 pt-6">
                <p className="label-mono">Coaching across</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {industries.slice(0, 7).map((i) => (
                    <span key={i} className="text-sm text-slate">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/*
           * The ink panel sits BESIDE the headline: it's the main contrast block and the
           * reason the hero doesn't read as bare text on a flat field. The image is part
           * of the same card rather than a separate element, so the hero stays one
           * composition.
           */}
          <aside className="overflow-hidden rounded-2xl bg-ink text-paper">
            {/*
             * ⚠️ PLACEHOLDER ART — swap for real brand photography.
             * Deliberately abstract/editorial, NOT a face: a generated face here would
             * imply a person who doesn't exist, on a page promising real people.
             * Host allowlisted in next.config.ts; remove both when real art lands.
             */}
            <Image
              src="https://picsum.photos/seed/trajectory-hero/1200/900"
              alt=""
              width={1200}
              height={900}
              priority
              aria-hidden
              className="h-44 w-full object-cover opacity-80"
            />

            <div className="p-8">
              <p className="font-mono text-xs tracking-widest text-gold uppercase">How it works</p>
              <ol className="mt-6 space-y-6">
                {[
                  { n: '01', t: 'Tell us where you’re headed', d: 'A short survey covering your year, your field, and what you need.' },
                  { n: '02', t: 'Pick someone who’s been there', d: 'Every coach is verified against their stated employer.' },
                  { n: '03', t: 'Book, pay, and talk', d: 'Pay securely, pick a time. Free cancellation up to 24 hours before.' },
                ].map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="font-mono text-xs text-gold">{s.n}</span>
                    <div>
                      <p className="font-display text-lg leading-snug text-paper">{s.t}</p>
                      <p className="mt-1 text-sm leading-relaxed text-paper/60">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </section>

      {/* ----------------------------------------------------------- COACHES */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-6 py-24 text-center">
          <p className="label-mono">Verified coaches</p>
          <h2 className="text-section mt-2">People who&rsquo;ve done it</h2>
          <p className="mx-auto mt-4 max-w-md text-slate">
            Every one of them has been checked against the employer they claim.
          </p>

          {/*
           * Roster-derived, never hardcoded: a fixed list becomes a false claim the moment
           * a coach leaves. If the roster empties, this renders nothing.
           */}
          {employers.length > 0 ? (
            <div className="mt-9 border-y border-line/15 py-5">
              <p className="label-mono">Coaches from</p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2">
                {employers.map((e) => (
                  <span key={e} className="font-display text-base text-ink/70">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <CoachCard key={c.userId} coach={c} />
            ))}
          </div>

          <Link
            href="/coaches"
            className="mt-10 inline-block text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
          >
            See all coaches
          </Link>
        </section>
      ) : null}

      {/* ------------------------------------------------- COACH CTA (anchor) */}
      <section className="relative overflow-hidden bg-ink">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
        />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-28 text-center">
          <p className="font-mono text-xs tracking-widest text-gold uppercase">For coaches</p>
          <h2 className="text-section mt-4 text-paper">Know something worth sharing?</h2>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-paper/70">
            Set your own rates and hours. Get paid per session. We review every coach before
            they go live.
          </p>
          <Button asChild size="lg" className="mt-8 bg-gold text-ink hover:bg-gold/90">
            <Link href="/sign-up">Become a coach</Link>
          </Button>
        </div>
      </section>

      {/* --------------------------------------------------------- TRUST BAND */}
      <section className="border-b border-line/15 bg-sand-deep">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-20 text-center sm:grid-cols-3">
          {[
            { t: 'Every coach is vetted', d: 'We verify each coach’s stated employer against their LinkedIn before their profile goes live.' },
            { t: 'Paid on-platform', d: 'Payment runs through Stripe. No off-platform arrangements, and no chasing anyone for an invoice.' },
            { t: TRUST_BLOCK_TITLE, d: TRUST_BLOCK_BODY },
          ].map((f) => (
            <div key={f.t}>
              <span aria-hidden className="mx-auto mb-4 block h-px w-10 bg-gold" />
              <h3 className="font-display text-lg leading-snug">{f.t}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
