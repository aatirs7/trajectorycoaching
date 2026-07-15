/**
 * Promote an existing account to admin.
 *
 *   npx tsx scripts/make-admin.ts you@example.com
 *
 * Sign up through the site FIRST — this promotes an existing Clerk user, it does not
 * create one.
 *
 * Writes Clerk first (the source of truth for role), then mirrors into Neon. Both are
 * needed: guards read the Neon mirror, and the user.updated webhook — the only other
 * thing that would sync it — isn't configured until there's a deployed URL to point it
 * at.
 *
 * Admin is deliberately NOT self-assignable through the app (see lib/auth/set-role.ts),
 * which is why it needs this out-of-band step.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../src/db/schema'
import { users } from '../src/db/schema'

const email = process.argv[2]

if (!email) {
  console.error('Usage: npx tsx scripts/make-admin.ts you@example.com')
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL
const clerkKey = process.env.CLERK_SECRET_KEY
if (!dbUrl) throw new Error('DATABASE_URL is not set — check .env.local')
if (!clerkKey) throw new Error('CLERK_SECRET_KEY is not set — check .env.local')

const db = drizzle({ client: neon(dbUrl), schema })

async function clerk<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${clerkKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) throw new Error(`Clerk ${path} → ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

type ClerkUser = { id: string; email_addresses: Array<{ email_address: string }> }

async function main() {
  const found = await clerk<ClerkUser[]>(
    `/users?email_address=${encodeURIComponent(email)}&limit=1`,
  )

  if (!found.length) {
    console.error(
      `No Clerk account for ${email}.\n` +
        `Sign up at the site first, then re-run this — it promotes an existing account ` +
        `rather than creating one.`,
    )
    process.exit(1)
  }

  const clerkUser = found[0]

  // 1. Clerk — the source of truth.
  await clerk(`/users/${clerkUser.id}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify({ public_metadata: { role: 'admin' } }),
  })

  // 2. Neon mirror — what every guard actually reads.
  const updated = await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.clerkId, clerkUser.id))
    .returning()

  if (!updated.length) {
    console.log(
      `Set admin in Clerk. No Neon row yet — that's fine: ensureUser() creates it on\n` +
        `your next authenticated page load, reading the role straight from Clerk.`,
    )
  } else {
    console.log(`${email} is now an admin (Clerk + Neon).`)
  }

  console.log('\nOpen /admin. If you were already signed in, just reload.')
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
