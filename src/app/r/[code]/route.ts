import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { resolveReferralCode, setReferralCookie } from '@/lib/auth/referral'

/**
 * Spec §6 — a coach's referral link: /r/<CODE>.
 *
 * Validates the code server-side and drops the referral cookie, then sends the visitor
 * to sign-up. The binding itself happens on their first authenticated request
 * (ensureUser) and is null-only, so it can never be changed afterwards.
 *
 * An unknown code silently proceeds to sign-up WITHOUT a cookie rather than erroring:
 * a typo'd or retired link should still let someone join (at the 30% platform tier),
 * not dead-end them. Silently granting a referral we can't verify would be the actual
 * bug, since it would cut our commission.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params

  const coachUserId = await resolveReferralCode(code)

  if (coachUserId) await setReferralCookie(code)

  redirect('/sign-up')
}
