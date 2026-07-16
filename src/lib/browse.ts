import 'server-only'
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { coachOfferings, coachProfiles, users } from '@/db/schema'

/**
 * Spec §8 — browse.
 *
 * Hard rule §2.4 is applied HERE, once: only `approved` coaches are ever returned. Every
 * browse surface goes through this module so an unapproved coach cannot leak into a
 * listing because someone forgot a WHERE clause.
 */
export type CoachCard = {
  userId: string
  fullName: string | null
  headshotUrl: string | null
  isSeed: boolean
  industry: string
  currentTitle: string
  bio: string
  specialties: string[]
  startingPriceCents: number
  lengths: number[]
}

export type BrowseFilters = {
  industry?: string
  maxPriceCents?: number
  lengthMinutes?: number
}

export async function listIndustries(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ industry: coachProfiles.industry })
    .from(coachProfiles)
    .where(eq(coachProfiles.status, 'approved'))
    .orderBy(asc(coachProfiles.industry))

  return rows.map((r) => r.industry)
}

export async function browseCoaches(filters: BrowseFilters = {}): Promise<CoachCard[]> {
  /**
   * A coach is only listed if they have at least one ACTIVE offering — a profile with no
   * bookable session is a dead end, and the card's "from $X" price has nothing to show.
   * The join makes that structural rather than a post-filter.
   */
  const conditions = [eq(coachProfiles.status, 'approved'), eq(coachOfferings.isActive, true)]

  if (filters.industry) conditions.push(eq(coachProfiles.industry, filters.industry))
  if (filters.lengthMinutes) conditions.push(eq(coachOfferings.lengthMinutes, filters.lengthMinutes))
  if (filters.maxPriceCents) conditions.push(lte(coachOfferings.priceCents, filters.maxPriceCents))

  const rows = await db
    .select({
      userId: coachProfiles.userId,
      fullName: users.fullName,
      headshotUrl: coachProfiles.headshotUrl,
      isSeed: coachProfiles.isSeed,
      industry: coachProfiles.industry,
      currentTitle: coachProfiles.currentTitle,
      bio: coachProfiles.bio,
      specialties: coachProfiles.specialties,
      priceCents: coachOfferings.priceCents,
      lengthMinutes: coachOfferings.lengthMinutes,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .innerJoin(coachOfferings, eq(coachOfferings.coachId, coachProfiles.userId))
    .where(and(...conditions))
    .orderBy(asc(coachOfferings.priceCents))

  // One row per offering → collapse to one card per coach, keeping the cheapest price
  // as the "from" and collecting the lengths that survived filtering.
  const byCoach = new Map<string, CoachCard>()

  for (const r of rows) {
    const existing = byCoach.get(r.userId)

    if (existing) {
      existing.startingPriceCents = Math.min(existing.startingPriceCents, r.priceCents)
      if (!existing.lengths.includes(r.lengthMinutes)) existing.lengths.push(r.lengthMinutes)
      continue
    }

    byCoach.set(r.userId, {
      userId: r.userId,
      fullName: r.fullName,
      headshotUrl: r.headshotUrl,
      isSeed: r.isSeed,
      industry: r.industry,
      currentTitle: r.currentTitle,
      bio: r.bio,
      specialties: r.specialties,
      startingPriceCents: r.priceCents,
      lengths: [r.lengthMinutes],
    })
  }

  return [...byCoach.values()]
    .map((c) => ({ ...c, lengths: c.lengths.sort((a, b) => a - b) }))
    .sort((a, b) => a.startingPriceCents - b.startingPriceCents)
}

/** A single coach's public profile (§8). Returns null unless they're approved. */
export async function getPublicCoach(userId: string) {
  const profile = await db.query.coachProfiles.findFirst({
    where: and(eq(coachProfiles.userId, userId), eq(coachProfiles.status, 'approved')),
  })

  if (!profile) return null

  const [coach, offerings] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.coachOfferings.findMany({
      where: and(eq(coachOfferings.coachId, userId), eq(coachOfferings.isActive, true)),
      orderBy: [asc(coachOfferings.lengthMinutes)],
    }),
  ])

  if (!coach) return null

  return { profile, coach, offerings }
}

/**
 * The employers currently on the roster, for the homepage "Coaches from" strip.
 *
 * DERIVED FROM LIVE DATA, never hardcoded: a hardcoded list becomes a false claim the
 * moment a coach leaves, and "we have someone at X" is exactly the kind of thing a
 * student would pick us over a competitor for. If the roster empties, this returns
 * nothing and the strip disappears rather than lying.
 *
 * Employer is parsed out of `current_title` ("Analyst at Evercore" → "Evercore"), which
 * is a heuristic on free text — hence the conservative bail-outs below. A separate
 * `employer` column would be better and is worth doing when someone next touches the
 * coach profile form; this avoids a migration and a form change for a decorative strip.
 */
export async function rosterEmployers(limit = 8): Promise<string[]> {
  const rows = await db
    .select({ currentTitle: coachProfiles.currentTitle })
    .from(coachProfiles)
    .where(eq(coachProfiles.status, 'approved'))

  const seen = new Set<string>()
  const employers: string[] = []

  for (const r of rows) {
    const employer = employerFromTitle(r.currentTitle)
    if (!employer) continue

    const key = employer.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    employers.push(employer)
  }

  return employers.slice(0, limit)
}

/** "Senior Software Engineer at Stripe" → "Stripe". Null when we can't tell. */
export function employerFromTitle(title: string): string | null {
  // Last " at " wins: "Resident Physician, Internal Medicine at Johns Hopkins".
  const idx = title.toLowerCase().lastIndexOf(' at ')
  if (idx === -1) return null

  const employer = title.slice(idx + 4).trim()

  // Bail rather than print rubbish: an empty tail, or something long enough that it's
  // probably a sentence rather than a company name.
  if (!employer || employer.length > 40) return null

  return employer
}

export async function priceBounds(): Promise<{ minCents: number; maxCents: number }> {
  const [row] = await db
    .select({
      min: sql<number>`COALESCE(MIN(${coachOfferings.priceCents}), 0)::int`,
      max: sql<number>`COALESCE(MAX(${coachOfferings.priceCents}), 0)::int`,
    })
    .from(coachOfferings)
    .innerJoin(coachProfiles, eq(coachProfiles.userId, coachOfferings.coachId))
    .where(and(eq(coachProfiles.status, 'approved'), eq(coachOfferings.isActive, true)))

  return { minCents: row?.min ?? 0, maxCents: row?.max ?? 0 }
}

/** Used by the sessions dashboard to name counterparties in bulk. */
export async function usersByIds(ids: string[]) {
  if (!ids.length) return []
  return db.query.users.findMany({ where: inArray(users.id, ids) })
}

export { gte }
