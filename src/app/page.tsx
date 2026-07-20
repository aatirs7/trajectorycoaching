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
 * scroll, rather than reading as one flat template:
 *
 *   hero          paper       centered type, no art
 *   how it works  INK         full-bleed
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
 *
 * WHY THE HERO IS CENTERED TYPE AND NOT TEXT-LEFT/CARD-RIGHT: the old split hero, over
 * a warm ground, under a serif headline with one accent-colored phrase, was the same
 * composition as the rest of this category. The differentiation is the whole point —
 * see the note at the top of globals.css before restoring a two-column hero.
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
    <main className="editorial flex-1">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="border-b border-line/10">
        <div className="mx-auto w-full max-w-4xl px-6 pt-28 pb-24 text-center">
          <p className="eyebrow">Career coaching, honestly</p>

          {/*
           * One color, no accent phrase. The emphasis comes from scale and tracking
           * instead — a colored word inside a display headline is the device this whole
           * category leans on, so it is deliberately absent.
           */}
          <h1 className="text-hero mx-auto mt-6 max-w-3xl text-balance">
            Reach the people who&rsquo;ve been there.
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-slate">
            Book time with people who already have the job you want. No mentorship theater
            and no generic advice. Just a real conversation with someone who did the thing
            you&rsquo;re trying to do.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={ctaHref}>{user ? 'Go to your dashboard' : 'Find a coach'}</Link>
            </Button>
            {!user ? (
              <Button asChild size="lg" variant="outline">
                <Link href="/coaches/apply">Coach on MentorReach</Link>
              </Button>
            ) : null}
          </div>

          {industries.length > 0 ? (
            <div className="mt-14">
              <p className="eyebrow">Coaching across</p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
                {industries.slice(0, 7).map((i) => (
                  <span key={i} className="text-sm text-slate">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* -------------------------------------------------------- HOW IT WORKS */}
      {/*
       * Pulled out of the old hero card into its own full-bleed ink band. It carries the
       * contrast the hero used to get from the side panel, without the split composition
       * — and without the placeholder stock photo that used to sit above it.
       */}
      <section className="bg-ink text-paper">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <p className="eyebrow text-center text-paper/50">How it works</p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              { n: '01', t: 'Tell us where you’re headed', d: 'A short survey covering your year, your field, and what you need.' },
              { n: '02', t: 'Pick someone who’s been there', d: 'Pick someone who’s actually done the thing you’re aiming for.' },
              { n: '03', t: 'Book, pay, and talk', d: 'Pay securely, pick a time. Free cancellation up to 24 hours before.' },
            ].map((s) => (
              <li key={s.n} className="border-t border-paper/15 pt-5">
                <span className="font-mono text-xs text-gold">{s.n}</span>
                <h3 className="mt-3 text-xl leading-snug text-paper">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/60">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------- COACHES */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-6 py-24 text-center">
          <p className="eyebrow">Our coaches</p>
          <h2 className="text-section mt-3">People who&rsquo;ve done it</h2>
          <p className="mx-auto mt-4 max-w-md text-slate">
            Hand-picked. We personally review every coach before they join.
          </p>

          {/*
           * Roster-derived, never hardcoded: a fixed list becomes a false claim the moment
           * a coach leaves. If the roster empties, this renders nothing.
           */}
          {employers.length > 0 ? (
            <div className="mt-9 border-y border-line/15 py-5">
              <p className="eyebrow">Coaches from</p>
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
          <p className="eyebrow text-paper/50">For coaches</p>
          <h2 className="text-section mt-4 text-paper">Know something worth sharing?</h2>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-paper/70">
            Set your own rates and hours. Get paid per session. We review every coach before
            they go live.
          </p>
          <Button asChild size="lg" className="mt-8 bg-gold text-ink hover:bg-gold/90">
            <Link href="/coaches/apply">Become a coach</Link>
          </Button>
        </div>
      </section>

      {/* --------------------------------------------------------- TRUST BAND */}
      <section className="border-b border-line/15 bg-sand-deep">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-20 text-center sm:grid-cols-3">
          {[
            { t: 'Hand-picked', d: 'We personally review every coach before they join.' },
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
