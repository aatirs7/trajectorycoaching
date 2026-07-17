import 'server-only'
import { and, asc, eq, gte, inArray, isNotNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { coachOfferings, coachProfiles, users } from '@/db/schema'
import { isCoachLive } from './coach-publish'

/**
 * Spec §8 — browse.
 *
 * The "is this coach live?" rule is applied HERE, once, so an unpublished coach cannot
 * leak into a listing because someone forgot a WHERE clause. It mirrors isCoachLive() in
 * coach-publish.ts: not suspended, AND either a seed/demo coach OR a real coach whose
 * DB-cheap publish requirements are met (photo, Calendly, Stripe payouts, handbook ack).
 * The ≥1-active-offering requirement is added by the offerings inner join below.
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

/**
 * The DB-cheap half of isCoachLive(), as a SQL condition. Kept in lockstep with
 * coach-publish.ts — bio/currentTitle/industry are NOT NULL columns so they're always
 * present, and the active-offering requirement comes from the offerings join.
 */
function liveCoachSql(): SQL {
  const realComplete = and(
    isNotNull(coachProfiles.headshotUrl),
    isNotNull(coachProfiles.calendlyUserUri),
    eq(coachProfiles.stripePayoutsEnabled, true),
    isNotNull(coachProfiles.handbookAckAt),
  )
  // biome-ignore lint: and()/or() are non-null here with fixed args.
  return and(ne(coachProfiles.status, 'suspended'), or(eq(coachProfiles.isSeed, true), realComplete))!
}

export async function listIndustries(): Promise<string[]> {
  // Only industries that have a browsable (live + offering) coach, so the filter never
  // shows an empty category.
  const rows = await db
    .selectDistinct({ industry: coachProfiles.industry })
    .from(coachProfiles)
    .innerJoin(coachOfferings, and(eq(coachOfferings.coachId, coachProfiles.userId), eq(coachOfferings.isActive, true)))
    .where(liveCoachSql())
    .orderBy(asc(coachProfiles.industry))

  return rows.map((r) => r.industry)
}

export async function browseCoaches(filters: BrowseFilters = {}): Promise<CoachCard[]> {
  /**
   * A coach is only listed if they have at least one ACTIVE offering — a profile with no
   * bookable session is a dead end, and the card's "from $X" price has nothing to show.
   * The join makes that structural rather than a post-filter, and it supplies the
   * offering half of the live check.
   */
  const conditions = [liveCoachSql(), eq(coachOfferings.isActive, true)]

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
      displayEmployerGenerally: coachProfiles.displayEmployerGenerally,
      generalTitle: coachProfiles.generalTitle,
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
      // Respect the coach's employer-visibility choice on the public card.
      currentTitle: r.displayEmployerGenerally && r.generalTitle ? r.generalTitle : r.currentTitle,
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

/**
 * A single coach's public profile (§8). Returns null unless the coach is LIVE — an
 * incomplete real coach's page 404s rather than being viewable by URL, matching browse.
 */
export async function getPublicCoach(userId: string) {
  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, userId),
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

  const live = isCoachLive({
    isSeed: profile.isSeed,
    status: profile.status,
    headshotUrl: profile.headshotUrl,
    currentTitle: profile.currentTitle,
    bio: profile.bio,
    hasActiveOffering: offerings.length > 0,
    calendlyUserUri: profile.calendlyUserUri,
    stripePayoutsEnabled: profile.stripePayoutsEnabled,
    handbookAckAt: profile.handbookAckAt,
  })

  if (!live) return null

  return { profile, coach, offerings }
}

/**
 * The employers currently on the roster, for the homepage "Coaches from" strip.
 *
 * DERIVED FROM LIVE DATA, never hardcoded: a hardcoded list becomes a false claim the
 * moment a coach leaves. If the roster empties, this returns nothing and the strip
 * disappears rather than lying.
 *
 * Employer is parsed out of `current_title` ("Analyst at Evercore" → "Evercore"), a
 * heuristic on free text — hence the conservative bail-outs below.
 */
export async function rosterEmployers(limit = 8): Promise<string[]> {
  const rows = await db
    .selectDistinct({ currentTitle: coachProfiles.currentTitle })
    .from(coachProfiles)
    .innerJoin(coachOfferings, and(eq(coachOfferings.coachId, coachProfiles.userId), eq(coachOfferings.isActive, true)))
    .where(liveCoachSql())

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
    .where(and(liveCoachSql(), eq(coachOfferings.isActive, true)))

  return { minCents: row?.min ?? 0, maxCents: row?.max ?? 0 }
}

/** Used by the sessions dashboard to name counterparties in bulk. */
export async function usersByIds(ids: string[]) {
  if (!ids.length) return []
  return db.query.users.findMany({ where: inArray(users.id, ids) })
}

export { gte }
