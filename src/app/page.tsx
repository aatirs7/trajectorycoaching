import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getDbUser } from '@/lib/auth/ensure-user'
import { browseCoaches } from '@/lib/browse'
import { formatPrice } from '@/lib/coach-schema'

/**
 * Spec §1 — the homepage. Warm, editorial, generous whitespace, no heavy shadows.
 * Every color and face here comes from the tokens in globals.css; there are no hardcoded
 * hexes and no shadow utilities on purpose.
 */
export default async function Home() {
  const user = await getDbUser()

  // Real coaches if we have them; the section hides itself if not.
  const featured = (await browseCoaches()).slice(0, 3)

  const ctaHref = user ? (user.role === 'coach' ? '/coach' : '/coaches') : '/sign-up'

  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28">
        <p className="label-mono">Career coaching, honestly</p>
        <h1 className="mt-5 max-w-3xl text-5xl leading-[1.05] sm:text-6xl">
          Own your trajectory.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate">
          Book time with people who already have the job you want. No mentorship theater, no
          generic advice — a real conversation with someone who did the thing you&rsquo;re
          trying to do.
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
      </section>

      <section className="border-y border-line/15 bg-secondary">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Tell us where you’re headed',
              body: 'A short survey — your year, your field, and what you actually need help with.',
            },
            {
              step: '02',
              title: 'Pick someone who’s been there',
              body: 'Browse verified coaches by field, price, and session length. We check every employer.',
            },
            {
              step: '03',
              title: 'Book, pay, and talk',
              body: 'Pay securely, pick a time that works, and meet. Free cancellation up to 24 hours before.',
            },
          ].map((s) => (
            <div key={s.step}>
              <p className="label-mono">{s.step}</p>
              <h2 className="mt-3 text-xl leading-snug">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-3xl">Coaches on Trajectory</h2>
            <Link href="/coaches" className="text-sm text-slate underline underline-offset-4 hover:text-ink">
              See all
            </Link>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {featured.map((c) => (
              <Link key={c.userId} href={`/coaches/${c.userId}`} className="group">
                <Card className="h-full border-line/20 p-6 transition-colors group-hover:border-gold">
                  <h3 className="text-lg leading-snug">{c.fullName ?? 'Coach'}</h3>
                  <p className="mt-1 text-sm text-slate">{c.currentTitle}</p>
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate">{c.bio}</p>
                  <p className="mt-5 border-t border-line/15 pt-4 text-sm text-slate">
                    from <span className="text-ink">{formatPrice(c.startingPriceCents)}</span>
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-5xl px-6 pt-4 pb-24">
        <Card className="border-line/20 p-10 text-center">
          <h2 className="text-3xl">Know something worth sharing?</h2>
          <p className="mx-auto mt-3 max-w-md text-slate">
            Set your own rates and hours. Get paid per session. We review every coach before
            they go live.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/sign-up">Become a coach</Link>
          </Button>
        </Card>
      </section>
    </main>
  )
}
