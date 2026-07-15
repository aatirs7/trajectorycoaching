/**
 * Push selected .env.local values into Vercel, without printing secrets.
 *
 * Only pushes vars that are actually set locally, so blank optional integrations stay
 * absent in Vercel rather than being set to "" — which the app reads as "not configured"
 * anyway, but an absent var is the honest representation.
 *
 * Usage: node scripts/push-env-to-vercel.mjs [--overwrite]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const overwrite = process.argv.includes('--overwrite')

const raw = readFileSync('.env.local', 'utf8')
const local = {}
for (const line of raw.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
  if (!m) continue
  const value = m[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
  if (value) local[m[1]] = value
}

/**
 * DATABASE_URL_UNPOOLED is deliberately NOT pushed: it's only used by drizzle-kit, which
 * runs from a workstation. Migrations don't run in the Vercel build (concurrent previews
 * would race DDL), so shipping a direct DB credential to production buys nothing.
 */
const TARGETS = [
  { key: 'DATABASE_URL', envs: ['production', 'preview', 'development'] },
  { key: 'CLERK_SECRET_KEY', envs: ['production', 'preview', 'development'] },
  { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', envs: ['production', 'preview', 'development'] },
  { key: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL', envs: ['production', 'preview', 'development'] },
  { key: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL', envs: ['production', 'preview', 'development'] },
  { key: 'NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL', envs: ['production', 'preview', 'development'] },
  { key: 'NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL', envs: ['production', 'preview', 'development'] },
  { key: 'CLERK_WEBHOOK_SIGNING_SECRET', envs: ['production', 'preview', 'development'] },
  { key: 'STRIPE_SECRET_KEY', envs: ['production', 'preview', 'development'] },
  { key: 'STRIPE_WEBHOOK_SECRET', envs: ['production', 'preview', 'development'] },
  { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', envs: ['production', 'preview', 'development'] },
  { key: 'CALENDLY_API_TOKEN', envs: ['production', 'preview', 'development'] },
  { key: 'CALENDLY_ORGANIZATION_URI', envs: ['production', 'preview', 'development'] },
  { key: 'CALENDLY_WEBHOOK_SIGNING_KEY', envs: ['production', 'preview', 'development'] },
  { key: 'RESEND_API_KEY', envs: ['production', 'preview', 'development'] },
  { key: 'EMAIL_FROM', envs: ['production', 'preview', 'development'] },
  { key: 'CRON_SECRET', envs: ['production', 'preview', 'development'] },
  { key: 'HEALTH_CHECK_TOKEN', envs: ['production', 'preview', 'development'] },
]

// Overrides that must differ from local (localhost would break Stripe returns + emails).
const OVERRIDES = process.env.PROD_APP_URL
  ? [{ key: 'NEXT_PUBLIC_APP_URL', value: process.env.PROD_APP_URL, envs: ['production'] }]
  : []

function vercel(args, input) {
  return execFileSync('npx', ['vercel', ...args], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  })
}

const added = []
const skipped = []
const failed = []

function push(key, value, envs) {
  for (const env of envs) {
    try {
      if (overwrite) {
        try {
          vercel(['env', 'rm', key, env, '--yes'])
        } catch {
          /* not present yet — fine */
        }
      }
      vercel(['env', 'add', key, env], value)
      added.push(`${key} → ${env}`)
    } catch (err) {
      const msg = String(err.stderr || err.message)
      if (msg.includes('already exists')) skipped.push(`${key} → ${env} (already set)`)
      else failed.push(`${key} → ${env}: ${msg.trim().split('\n').pop()}`)
    }
  }
}

for (const t of TARGETS) {
  const value = local[t.key]
  if (!value || value.startsWith('whsec_placeholder')) {
    skipped.push(`${t.key} (not set locally)`)
    continue
  }
  push(t.key, value, t.envs)
}

for (const o of OVERRIDES) push(o.key, o.value, o.envs)

console.log('\n--- ADDED ---')
added.forEach((a) => console.log('  ✓', a))
console.log('\n--- SKIPPED ---')
skipped.forEach((s) => console.log('  ·', s))
if (failed.length) {
  console.log('\n--- FAILED ---')
  failed.forEach((f) => console.log('  ✗', f))
  process.exitCode = 1
}
