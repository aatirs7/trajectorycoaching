import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { formatPrice } from '@/lib/coach-schema'
import { initialOf, resolveHeadshot } from '@/lib/headshot'

export type CoachCardData = {
  userId: string
  fullName: string | null
  headshotUrl: string | null
  isSeed: boolean
  currentTitle: string
  industry: string
  specialties: string[]
  startingPriceCents: number
  lengths: number[]
}

/**
 * One coach card, shared by browse and the homepage so the two can't drift.
 *
 * The avatar goes through resolveHeadshot(), which is what stops a generated face ever
 * appearing on a real (non-seed) profile. Don't reach for `headshotUrl` directly here.
 */
export function CoachAvatar({
  coach,
  size = 48,
  className = '',
}: {
  coach: Pick<CoachCardData, 'fullName' | 'headshotUrl' | 'isSeed'>
  size?: number
  className?: string
}) {
  const source = resolveHeadshot(coach)

  if (source.kind === 'image') {
    return (
      <Image
        src={source.url}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full border border-line/15 object-cover ${className}`}
        // Decorative: the name is adjacent in the DOM, so announcing the photo too would
        // just make a screen reader say it twice.
        aria-hidden
      />
    )
  }

  return (
    <div
      aria-hidden
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-ink font-display text-paper ${className}`}
    >
      {initialOf(coach.fullName)}
    </div>
  )
}

export function SpecialtyTags({ specialties, max = 3 }: { specialties: string[]; max?: number }) {
  if (!specialties.length) return null

  return (
    <ul className="mt-4 flex flex-wrap gap-1.5">
      {specialties.slice(0, max).map((s) => (
        <li
          key={s}
          className="rounded-full border border-gold/45 px-2.5 py-1 font-mono text-[10px] tracking-wide text-slate uppercase"
        >
          {s}
        </li>
      ))}
    </ul>
  )
}

export function CoachCard({ coach }: { coach: CoachCardData }) {
  return (
    <Link href={`/coaches/${coach.userId}`} className="group block h-full">
      {/* flex-col so the price row can mt-auto to the bottom and the cards line up. */}
      <Card className="flex h-full flex-col gap-0 border-line/15 bg-raised p-6 transition-all group-hover:-translate-y-0.5 group-hover:border-gold">
        <div className="flex items-center gap-3.5">
          <CoachAvatar coach={coach} size={52} className="text-lg" />
          <div className="min-w-0">
            <h3 className="truncate text-base leading-snug">{coach.fullName ?? 'Coach'}</h3>
            <p className="truncate text-xs leading-relaxed text-slate">{coach.currentTitle}</p>
          </div>
        </div>

        <p className="mt-4 font-mono text-[10px] tracking-widest text-gold uppercase">
          {coach.industry}
        </p>

        {/* No bio here: the card is a scanning surface. The bio lives on the profile. */}
        <SpecialtyTags specialties={coach.specialties} />

        <div className="mt-auto flex items-baseline justify-between border-t border-line/12 pt-5">
          <span className="text-sm text-slate">
            from{' '}
            <span className="font-display text-base text-ink">
              {formatPrice(coach.startingPriceCents)}
            </span>
          </span>
          <span className="font-mono text-[10px] tracking-widest text-slate uppercase">
            {coach.lengths.join(' / ')} min
          </span>
        </div>
      </Card>
    </Link>
  )
}
