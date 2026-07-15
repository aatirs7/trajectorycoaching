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
/**
 * An optional var where an EMPTY STRING means "not configured".
 *
 * This matters far more than it looks. A .env file habitually carries `KEY=""`
 * placeholders for services you haven't set up yet — that is exactly the shape of
 * .env.example. A plain `z.string().min(1).optional()` treats "" as PRESENT-BUT-INVALID
 * rather than absent, so one blank placeholder throws at boot and takes the entire app
 * down, which defeats the whole point of having an optional tier.
 */
const optionalKey = () =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional())

const schema = z.object({
  // --- Required ------------------------------------------------------------
  /** Neon POOLED connection string (…-pooler.…). Migrations use the unpooled one. */
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),

  // --- Optional: activate an integration when supplied ----------------------
  /** Spec §10. Stripe Connect (platform account). */
  STRIPE_SECRET_KEY: optionalKey(),
  STRIPE_WEBHOOK_SECRET: optionalKey(),

  /** Spec §9. Calendly Teams org personal access token. */
  CALENDLY_API_TOKEN: optionalKey(),
  CALENDLY_WEBHOOK_SIGNING_KEY: optionalKey(),
  /** The Calendly org URI (https://api.calendly.com/organizations/…). */
  CALENDLY_ORGANIZATION_URI: optionalKey(),

  /** Spec §12. Resend. */
  RESEND_API_KEY: optionalKey(),
  /** e.g. "Trajectory Coaching <hello@trajectorycoaches.com>" */
  EMAIL_FROM: optionalKey(),

  /** Protects /api/cron. Required in production for the §11 completion job. */
  CRON_SECRET: optionalKey(),

  /** Gates /api/health in production. */
  HEALTH_CHECK_TOKEN: optionalKey(),

  /** Same empty-string treatment: a blank NEXT_PUBLIC_APP_URL should fall back, not throw. */
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (v) => (v === '' || v === undefined ? 'http://localhost:3000' : v),
    z.string().url(),
  ),
})

type Env = z.infer<typeof schema>

let cached: Env | null = null

/**
 * Validate on FIRST ACCESS, not at import.
 *
 * This is load-bearing and non-obvious. `next build` evaluates every module to collect
 * page data, so a top-level `schema.parse(process.env)` runs at BUILD time — meaning the
 * build demands production secrets that, on a fresh deploy, don't exist yet. It fails
 * with "Failed to collect page data", which points at a route file rather than at the
 * real cause.
 *
 * Deferring to first property access moves the check to request time, where it belongs:
 * the build needs no secrets, and a genuinely missing var still fails loudly on the
 * first request that needs it, with the message below.
 *
 * Do not "simplify" this back to a module-scope parse.
 */
function load(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')

    throw new Error(
      `Invalid or missing REQUIRED environment variables:\n${missing}\n\n` +
        `Set these in .env.local locally, and in Vercel → Settings → Environment Variables\n` +
        `for a deployment. See .env.example.`,
    )
  }

  cached = parsed.data
  return cached
}

/**
 * Reads like a plain object; validates lazily behind a Proxy. `env.DATABASE_URL` throws
 * the message above if it's absent — at request time, not build time.
 */
export const env = new Proxy({} as Env, {
  get: (_target, prop: string) => load()[prop as keyof Env],
  has: (_target, prop: string) => prop in load(),
  ownKeys: () => Reflect.ownKeys(load()),
  getOwnPropertyDescriptor: (_target, prop: string) =>
    Object.getOwnPropertyDescriptor(load(), prop),
})

/**
 * Keys whose absence disables a feature rather than the app.
 *
 * The `-?` is load-bearing: without it the mapped type preserves the source's
 * optionality and every member unions with `undefined`, which then isn't a valid
 * index type.
 */
type OptionalKey = {
  [K in keyof Env]-?: undefined extends Env[K] ? K : never
}[keyof Env]

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
