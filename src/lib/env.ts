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

  // --- Optional: activate an integration when supplied ----------------------
  /**
   * Spec §3. Clerk → Neon mirror webhook.
   *
   * OPTIONAL, not required, and the ordering is why: this secret cannot exist until the
   * webhook endpoint does, and the endpoint needs a deployed URL — so requiring it makes
   * the first deploy impossible. It's an integration key like any other.
   *
   * Without it the webhook route 503s and role/email changes made in the Clerk dashboard
   * don't propagate; ensureUser() still mirrors users on their first authenticated
   * request, which is why the app is fully usable in the meantime.
   */
  CLERK_WEBHOOK_SIGNING_SECRET: optionalKey(),
  /** Spec §10. Stripe Connect (platform account). */
  STRIPE_SECRET_KEY: optionalKey(),
  STRIPE_WEBHOOK_SECRET: optionalKey(),

  /**
   * Zoom Server-to-Server OAuth app — powers the native scheduler's video meetings.
   * One platform Zoom account creates a meeting per booking. All three are needed.
   */
  ZOOM_ACCOUNT_ID: optionalKey(),
  ZOOM_CLIENT_ID: optionalKey(),
  ZOOM_CLIENT_SECRET: optionalKey(),

  /** Spec §12. Resend. */
  RESEND_API_KEY: optionalKey(),
  /** e.g. "MentorReach <hello@mentorreach.com>" */
  EMAIL_FROM: optionalKey(),

  /** Vercel Blob store token — enables coach headshot uploads. Auto-injected on Vercel
   *  when a Blob store is connected. */
  BLOB_READ_WRITE_TOKEN: optionalKey(),

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

  /**
   * A production Clerk key in a local environment is a silent trap, so make it loud.
   *
   * A pk_live_ encodes the domain it is bound to — ours decodes to
   * "clerk.mentorreach.com" — and the production instance refuses any other origin. Point
   * localhost at it and sign-in simply stops working, with no error that names the cause.
   *
   * What makes it costly is the .env precedence rule: a duplicate key LATER in the file
   * wins, so a live pair pasted at the bottom silently overrides the pk_test_ pair at the
   * top. The file looks correct at a glance. This has cost real debugging time here more
   * than once, which is why it's a hard failure rather than a warning.
   *
   * Development only. VERCEL_ENV is 'production' on a production deploy, where a live key
   * is exactly right, and 'preview' on preview deploys, where the guard would be wrong to
   * fire on a build that legitimately carries whatever the project has configured.
   */
  if (process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV) {
    const live = (['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'] as const).filter((k) =>
      /^(pk|sk)_live_/.test(process.env[k] ?? ''),
    )

    if (live.length) {
      throw new Error(
        `Production Clerk keys found in local development: ${live.join(', ')}.\n\n` +
          `A pk_live_ is locked to clerk.mentorreach.com and will reject http://localhost,\n` +
          `so sign-in breaks with no useful error. Remember that a duplicate key later in\n` +
          `.env.local overrides the pk_test_ pair above it.\n\n` +
          `Fix: delete the pk_live_/sk_live_ lines from .env.local. Production reads its\n` +
          `own copy from Vercel and is unaffected.`,
      )
    }
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
        `Add it to .env.local (and to Vercel). See .env.example. ` +
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
    clerkWebhook: Boolean(env.CLERK_WEBHOOK_SIGNING_SECRET),
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(env.STRIPE_WEBHOOK_SECRET),
    zoom: Boolean(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET),
    email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    cron: Boolean(env.CRON_SECRET),
    storage: Boolean(env.BLOB_READ_WRITE_TOKEN),
  }
}

/** True when a student can actually complete a booking end-to-end (§8). */
export function bookingEnabled(): boolean {
  const s = integrationStatus()
  return s.stripe && s.zoom
}
