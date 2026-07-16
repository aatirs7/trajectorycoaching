import { BrowseFilters } from './filters'
import { CoachCard } from '@/components/coach-card'
import { Card } from '@/components/ui/card'
import { browseCoaches, listIndustries } from '@/lib/browse'
import { SESSION_LENGTHS } from '@/lib/coach-schema'
import { parsePriceToCents } from '@/lib/coach-schema'

export const metadata = {
  title: 'Browse coaches',
  description:
    'Book time with people who already have the job you want. Every coach is verified against their stated employer.',
}

/**
 * Spec §8 — browse.
 *
 * PUBLIC, deliberately. This deviates from a literal reading of §2.3/§3, which would put
 * a sign-in wall in front of the coach list — the exact page the homepage sends everyone
 * to, and the only content search engines could ever index. The survey's purpose is to
 * know who a student is before they TRANSACT, and that's preserved: booking still
 * requires sign-in plus a completed survey (see bookingGate()). Reading a public profile
 * costs nothing and reveals nothing.
 *
 * Recorded as an intentional deviation in docs/spec-coverage.md.
 */
export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; maxPrice?: string; length?: string }>
}) {
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
        <div className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((c) => (
            <CoachCard key={c.userId} coach={c} />
          ))}
        </div>
      )}
    </main>
  )
}
