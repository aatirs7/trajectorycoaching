import 'server-only'
import Stripe from 'stripe'
import { env, requireEnv } from './env'

/**
 * Spec §10 — Stripe Connect. Trajectory is the platform; coaches are Express
 * connected accounts.
 *
 * Lazily constructed on purpose: building the client at module scope would throw at
 * import time when STRIPE_SECRET_KEY is absent, which would break `next build` and any
 * page that transitively imports this. Instead the error surfaces only on the one path
 * that actually needs Stripe.
 */
let client: Stripe | null = null

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv('STRIPE_SECRET_KEY', 'Stripe payments'), {
      // Pinned to the version this SDK was built against — silent API drift on a
      // money path is not acceptable. Bump deliberately, alongside the SDK.
      apiVersion: '2026-06-24.dahlia',
      appInfo: { name: 'Trajectory Coaching' },
    })
  }
  return client
}

export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY)
}

/**
 * Spec §10 — Express onboarding for a coach. Surfaced at/after approval.
 * Returns the account id to persist on coach_profiles.stripe_account_id.
 */
export async function createExpressAccount(params: {
  email: string
  coachUserId: string
}): Promise<string> {
  const account = await stripe().accounts.create({
    type: 'express',
    email: params.email,
    business_type: 'individual',
    capabilities: {
      transfers: { requested: true },
    },
    metadata: { coachUserId: params.coachUserId },
  })

  return account.id
}

/** The hosted onboarding link a coach follows to finish Express setup. */
export async function createAccountOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${env.NEXT_PUBLIC_APP_URL}/coach/payouts?refresh=1`,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/coach/payouts?done=1`,
    type: 'account_onboarding',
  })

  return link.url
}

/** A coach can only be paid once Stripe says transfers are enabled. */
export async function accountPayoutsReady(accountId: string): Promise<boolean> {
  const account = await stripe().accounts.retrieve(accountId)
  return Boolean(account.charges_enabled && account.payouts_enabled)
}

/** Dashboard link for a coach to see their own payouts. */
export async function createLoginLink(accountId: string): Promise<string> {
  const link = await stripe().accounts.createLoginLink(accountId)
  return link.url
}
