import 'server-only'
import { z } from 'zod'

/**
 * Server-side env validation.
 *
 * TWO TIERS, deliberately:
 *
 *   REQUIRED — the app genuinely cannot serve a request without these, so they're
 *   validated at boot and a missing one is a loud startup failure.
 *
 *   OPTIONAL — third-party integrations (Stripe, Calendly, Resend). These are typed
 *   optional so the app BUILDS AND RUNS without them. Each integration's client module
 *   calls `requireEnv()` at point of use, so a missing key produces one clear error on
 *   the one code path that needs it, rather than taking down the whole app at boot.
 *
 * That split is what lets the platform be developed end-to-end before the accounts
 * exist. `integrationStatus()` below reports what's live; /admin/integrations renders it.
 *
 * Hand-rolled rather than @t3-oss/env-nextjs: it's a few lines, and that package's whole
 * job is a client/server split we don't have. NEXT_PUBLIC_* vars must be referenced as
 * full literals (`process.env.NEXT_PUBLIC_X`) in client code for Next's inliner to see
 * them, so they don't belong in this module anyway.
 */
const schema = z.object({
  // --- Required ------------------------------------------------------------
  /** Neon POOLED connection string (…-pooler.…). Migrations use the unpooled one. */
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),

  // --- Optional: activate an integration when supplied ----------------------
  /** Spec §10. Stripe Connect (platform account). */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  /** Spec §9. Calendly Teams org personal access token. */
  CALENDLY_API_TOKEN: z.string().min(1).optional(),
  CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1).optional(),
  /** The Calendly org URI (https://api.calendly.com/organizations/…). */
  CALENDLY_ORGANIZATION_URI: z.string().min(1).optional(),

  /** Spec §12. Resend. */
  RESEND_API_KEY: z.string().min(1).optional(),
  /** e.g. "Trajectory Coaching <hello@trajectorycoaches.com>" */
  EMAIL_FROM: z.string().min(1).optional(),

  /** Protects /api/cron/*. Required in production for the §11 completion job. */
  CRON_SECRET: z.string().min(1).optional(),

  /** Gates /api/health in production. */
  HEALTH_CHECK_TOKEN: z.string().min(1).optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(
    `Invalid or missing REQUIRED environment variables:\n${missing}\n\nSee .env.example.`,
  )
}

export const env = parsed.data

/**
 * Keys whose absence disables a feature rather than the app.
 *
 * The `-?` is load-bearing: without it the mapped type preserves the source's
 * optionality and every member unions with `undefined`, which then isn't a valid
 * index type.
 */
type OptionalKey = {
  [K in keyof typeof env]-?: undefined extends (typeof env)[K] ? K : never
}[keyof typeof env]

/**
 * Read an optional env var at point of use, failing with an actionable message.
 *
 * Call this INSIDE the function that needs the key, never at module top level — a
 * top-level throw would break `next build`, which is exactly what we're avoiding.
 */
export function requireEnv(key: OptionalKey, feature: string): string {
  const value = env[key]

  if (!value) {
    throw new Error(
      `${feature} is not configured: ${key} is missing from the environment.\n` +
        `Add it to .env.local (and to Vercel) — see .env.example. ` +
        `Until then, this feature is intentionally disabled and the rest of the app is unaffected.`,
    )
  }

  return value as string
}

/**
 * Which integrations are live. Drives /admin/integrations and lets UI degrade honestly
 * (e.g. disable the "Book" button with a reason) instead of throwing at the user.
 */
export function integrationStatus() {
  return {
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(env.STRIPE_WEBHOOK_SECRET),
    calendly: Boolean(env.CALENDLY_API_TOKEN && env.CALENDLY_ORGANIZATION_URI),
    calendlyWebhook: Boolean(env.CALENDLY_WEBHOOK_SIGNING_KEY),
    email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    cron: Boolean(env.CRON_SECRET),
  }
}

/** True when a student can actually complete a booking end-to-end (§8). */
export function bookingEnabled(): boolean {
  const s = integrationStatus()
  return s.stripe && s.calendly
}
