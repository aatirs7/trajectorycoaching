import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getDbUser } from '@/lib/auth/ensure-user'
import { browseCoaches, listIndustries } from '@/lib/browse'
import { formatPrice } from '@/lib/coach-schema'

/**
 * Spec §1 — the homepage. Warm, editorial, generous whitespace, no heavy shadows.
 *
 * "No heavy shadows" is a constraint on shadows, not on depth. Depth here is built from
 * stacked surfaces (sand → paper → raised), full-bleed ink blocks, and gold rules — the
 * way an editorial layout does it. Every value comes from the tokens in globals.css;
 * there are no hardcoded hexes.
 */
export default async function Home() {
  const user = await getDbUser()

  const [featured, industries] = await Promise.all([
    browseCoaches().then((c) => c.slice(0, 6)),
    listIndustries(),
  ])

  const ctaHref = user ? (user.role === 'coach' ? '/coach' : '/coaches') : '/sign-up'

  return (
    <main className="flex-1">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden border-b border-line/15 bg-sand">
        {/* Warm gold wash — a soft light source, not a shadow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
        />

        <div className="relative mx-auto w-full max-w-3xl px-6 pt-20 pb-20 text-center sm:pt-24">
          <p className="label-mono flex items-center justify-center gap-2">
            <span className="inline-block h-px w-8 bg-gold" />
            Career coaching, honestly
            <span className="inline-block h-px w-8 bg-gold" />
          </p>

          <h1 className="mt-5 text-5xl leading-[1.03] sm:text-6xl">
            Own your <span className="italic text-line">trajectory</span>.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate">
            Book time with people who already have the job you want. No mentorship theater and
            no generic advice. Just a real conversation with someone who did the thing
            you&rsquo;re trying to do.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
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
            <div className="mx-auto mt-10 max-w-xl border-t border-line/15 pt-6">
              <p className="label-mono">Coaching across</p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {industries.slice(0, 6).map((i) => (
                  <span key={i} className="text-sm text-slate">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------- HOW IT WORKS */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl bg-ink px-8 py-12 text-center">
          <p className="font-mono text-xs tracking-widest text-gold uppercase">How it works</p>

          <ol className="mx-auto mt-9 grid max-w-4xl gap-10 sm:grid-cols-3">
            {[
              { n: '01', t: 'Tell us where you’re headed', d: 'A short survey covering your year, your field, and what you actually need help with.' },
              { n: '02', t: 'Pick someone who’s been there', d: 'Browse verified coaches by field, price, and session length.' },
              { n: '03', t: 'Book, pay, and talk', d: 'Pay securely, pick a time that works. Free cancellation up to 24 hours before.' },
            ].map((s) => (
              <li key={s.n}>
                <span className="font-mono text-xs text-gold">{s.n}</span>
                <p className="mt-3 font-display text-xl leading-snug text-paper">{s.t}</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-paper/60">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------- COACHES */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-6 py-20 text-center">
          <p className="label-mono">Verified coaches</p>
          <h2 className="mt-2 text-3xl">People who&rsquo;ve done it</h2>
          <p className="mx-auto mt-3 max-w-md text-slate">
            Every one of them has been checked against the employer they claim.
          </p>

          <div className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <Link key={c.userId} href={`/coaches/${c.userId}`} className="group">
                <Card className="h-full gap-0 border-line/15 bg-raised p-6 transition-all group-hover:-translate-y-0.5 group-hover:border-gold">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-base text-paper"
                    >
                      {(c.fullName ?? '?').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base leading-snug">{c.fullName ?? 'Coach'}</h3>
                      <p className="truncate text-xs text-slate">{c.currentTitle}</p>
                    </div>
                  </div>

                  <p className="mt-4 font-mono text-[10px] tracking-widest text-gold uppercase">
                    {c.industry}
                  </p>

                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate">{c.bio}</p>

                  <div className="mt-5 flex items-baseline justify-between border-t border-line/12 pt-4">
                    <span className="text-sm text-slate">
                      from <span className="font-display text-base text-ink">{formatPrice(c.startingPriceCents)}</span>
                    </span>
                    <span className="font-mono text-[10px] tracking-widest text-slate uppercase">
                      {c.lengths.join(' / ')} min
                    </span>
                  </div>
                </Card>
              </Link>
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

      {/* --------------------------------------------------------- TRUST BAND */}
      <section className="border-y border-line/15 bg-sand-deep">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 text-center sm:grid-cols-3">
          {[
            { t: 'Every coach is vetted', d: 'We verify each coach’s stated employer against their LinkedIn before their profile goes live.' },
            { t: 'Paid on-platform', d: 'Payment runs through Stripe. No off-platform arrangements, and no chasing anyone for an invoice.' },
            { t: '24-hour cancellation', d: 'Cancel or reschedule free up to 24 hours before. Inside that, the slot is held for you.' },
          ].map((f) => (
            <div key={f.t}>
              <span aria-hidden className="mx-auto mb-4 block h-px w-10 bg-gold" />
              <h3 className="text-lg leading-snug">{f.t}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl bg-ink px-8 py-14 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
          />
          <div className="relative">
            <p className="font-mono text-xs tracking-widest text-gold uppercase">For coaches</p>
            <h2 className="mt-3 text-3xl text-paper sm:text-4xl">Know something worth sharing?</h2>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-paper/70">
              Set your own rates and hours. Get paid per session. We review every coach
              before they go live.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-7 bg-gold text-ink hover:bg-gold/90"
            >
              <Link href="/sign-up">Become a coach</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
