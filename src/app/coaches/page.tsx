import Link from 'next/link'
import { BrowseFilters } from './filters'
import { Card } from '@/components/ui/card'
import { requireStudent } from '@/lib/auth/guards'
import { browseCoaches, listIndustries } from '@/lib/browse'
import { formatPrice, SESSION_LENGTHS } from '@/lib/coach-schema'
import { parsePriceToCents } from '@/lib/coach-schema'

export const metadata = { title: 'Browse coaches' }

/**
 * Spec §8 — browse. Hard rule §2.3 gates this behind the survey: requireStudent()
 * redirects to /onboarding/survey unless completed_at is set.
 */
export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; maxPrice?: string; length?: string }>
}) {
  await requireStudent()

  const params = await searchParams

  const maxPriceCents = params.maxPrice ? parsePriceToCents(params.maxPrice) : null
  const lengthMinutes = params.length ? Number(params.length) : undefined

  const [coaches, industries] = await Promise.all([
    browseCoaches({
      industry: params.industry || undefined,
      maxPriceCents: maxPriceCents ?? undefined,
      lengthMinutes: SESSION_LENGTHS.includes(lengthMinutes as 30 | 45 | 60)
        ? lengthMinutes
        : undefined,
    }),
    listIndustries(),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
      <div className="text-center">
        <p className="label-mono">Coaches</p>
        <h1 className="mt-3 text-4xl">Find someone who&rsquo;s done it</h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
          Every coach here has been reviewed and verified against their stated employer.
        </p>
      </div>

      <BrowseFilters industries={industries} />

      {coaches.length === 0 ? (
        <Card className="mt-10 border-line/20 p-10 text-center">
          <p className="text-lg">No coaches match those filters yet.</p>
          <p className="mt-2 text-sm text-slate">
            Try widening your search, or check back shortly. We&rsquo;re onboarding coaches now.
          </p>
        </Card>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((c) => (
            <Link key={c.userId} href={`/coaches/${c.userId}`} className="group">
              <Card className="h-full gap-0 border-line/15 bg-raised p-6 transition-all group-hover:-translate-y-0.5 group-hover:border-gold">
                <div className="flex items-start gap-3">
                  {c.headshotUrl ? (
                    /*
                     * Coach-supplied URL from an arbitrary host. next/image would need a
                     * remotePatterns entry per domain, which we can't enumerate. Revisit
                     * when headshots are uploaded to storage we control.
                     */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.headshotUrl}
                      alt=""
                      className="size-12 shrink-0 rounded-full border border-line/20 object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg text-paper"
                    >
                      {(c.fullName ?? '?').charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="truncate text-lg leading-snug">{c.fullName ?? 'Coach'}</h2>
                    <p className="truncate text-sm text-slate">{c.currentTitle}</p>
                  </div>
                </div>

                <p className="mt-4 font-mono text-[10px] tracking-widest text-gold uppercase">
                  {c.industry}
                </p>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate">{c.bio}</p>

                <div className="mt-5 flex items-baseline justify-between border-t border-line/12 pt-4">
                  <span className="text-sm text-slate">
                    from{' '}
                    <span className="font-display text-base text-ink">
                      {formatPrice(c.startingPriceCents)}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] tracking-widest text-slate uppercase">
                    {c.lengths.join(' / ')} min
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
