import 'server-only'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { coachProfiles } from '@/db/schema'

/**
 * Spec §6 — referral capture.
 *
 * Flow: a coach shares /r/<CODE> → that route validates the code and drops this cookie
 * → the visitor signs up → their first authenticated request (ensureUser) consumes the
 * cookie and writes users.referred_by_coach_id.
 *
 * "Immutable after signup" (§6) is enforced by only ever filling a NULL: the write is a
 * COALESCE, so the value can transition null → coach exactly once and never change
 * again. The cookie is cleared on consumption, so there's no second chance to set it.
 *
 * WHY A COOKIE rather than Clerk unsafeMetadata: unsafeMetadata is client-writable by
 * design, and this value decides whether we take 20% or 30%. A user who can set their
 * own referral can cut our commission. A short-lived HTTP-only cookie can't be forged
 * into a valid code, because the code is resolved server-side against coach_profiles.
 */
export const REFERRAL_COOKIE = 'trajectory_ref'

const THIRTY_DAYS = 60 * 60 * 24 * 30

/** Referral codes are stored and compared uppercase (avoids the citext extension). */
export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase()
}

/** Resolve a referral code to the coach's user id, or null if it isn't a real code. */
export async function resolveReferralCode(code: string): Promise<string | null> {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return null

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.referralCode, normalized),
    columns: { userId: true },
  })

  return profile?.userId ?? null
}

export async function setReferralCookie(code: string): Promise<void> {
  const jar = await cookies()
  jar.set(REFERRAL_COOKIE, normalizeReferralCode(code), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: THIRTY_DAYS,
    path: '/',
  })
}

export async function readReferralCookie(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(REFERRAL_COOKIE)?.value ?? null
}

export async function clearReferralCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(REFERRAL_COOKIE)
}

/**
 * Generate a referral code for a new coach profile. Ambiguous glyphs (0/O, 1/I) are
 * excluded because these get read aloud and typed by hand.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateReferralCode(fullName: string | null): string {
  const initials = (fullName ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')

  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  const random = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')

  return `${initials || 'TC'}${random}`
}
