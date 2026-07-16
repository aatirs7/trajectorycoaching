/**
 * The single place a coach's avatar is resolved.
 *
 * THE RULE THIS ENFORCES: placeholder faces are for SEED coaches only. A real coach's
 * profile must never render a generated face while the site tells students every coach
 * is "verified against their stated employer". A stock face on a supposedly-vetted
 * profile isn't a cosmetic slip, it's the vetting promise being false at the most
 * visible point on the page.
 *
 * It's enforced here rather than by remembering: even if a real profile somehow ends up
 * with a pravatar URL (pasted by a coach, copied from seed data, restored from a bad
 * backup), this function refuses it and falls back to initials. `isSeed` defaults to
 * false in the schema, so a real coach cannot become seed by omission either.
 *
 * Not 'server-only': used by client card components.
 */

/**
 * Hosts that generate faces/imagery on demand. Anything served from one of these is a
 * placeholder by definition, whoever set it.
 */
const PLACEHOLDER_HOSTS = ['i.pravatar.cc', 'pravatar.cc', 'picsum.photos', 'placehold.co']

export function isPlaceholderImage(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return PLACEHOLDER_HOSTS.includes(host)
  } catch {
    return false
  }
}

export type HeadshotSource =
  | { kind: 'image'; url: string }
  /** Render the initials circle. `reason` is for debugging, not for users. */
  | { kind: 'initials'; reason: 'none-set' | 'placeholder-on-real-profile' | 'invalid-url' }

export function resolveHeadshot(profile: {
  headshotUrl: string | null
  isSeed: boolean
}): HeadshotSource {
  if (!profile.headshotUrl) return { kind: 'initials', reason: 'none-set' }

  let parsed: URL
  try {
    parsed = new URL(profile.headshotUrl)
  } catch {
    return { kind: 'initials', reason: 'invalid-url' }
  }

  // No mixed content, and no javascript:/data: URLs reaching an <img src>.
  if (parsed.protocol !== 'https:') return { kind: 'initials', reason: 'invalid-url' }

  // THE GUARDRAIL. A real profile never renders a generated face, no matter who set it.
  if (!profile.isSeed && isPlaceholderImage(profile.headshotUrl)) {
    return { kind: 'initials', reason: 'placeholder-on-real-profile' }
  }

  return { kind: 'image', url: profile.headshotUrl }
}

/** Deterministic placeholder portrait for a seed coach. Same id, same face, every time. */
export function seedHeadshotUrl(seedKey: string): string {
  return `https://i.pravatar.cc/400?u=${encodeURIComponent(seedKey)}`
}

export function initialOf(fullName: string | null): string {
  return (fullName?.trim()?.[0] ?? '?').toUpperCase()
}
