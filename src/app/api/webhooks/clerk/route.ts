import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { env } from '@/lib/env'
import type { Role } from '@/types/globals'

/**
 * The Clerk → Neon mirror, propagation half. See src/lib/auth/ensure-user.ts for why
 * both halves exist.
 *
 * This is what makes role/email/name changes made in the Clerk dashboard reach Neon
 * without the user visiting a page. UNIQUE(clerk_id) makes it commutative with
 * ensureUser(), so ordering doesn't matter.
 *
 * Signature verification uses Clerk's own verifyWebhook() (reads
 * CLERK_WEBHOOK_SIGNING_SECRET from the env). Do NOT hand-roll this with `svix` — that
 * was the old pattern and is no longer necessary.
 *
 * Always return 2xx on success or Clerk retries. A 400 in Clerk's webhook log means the
 * signing secret is wrong; a 500 means this handler threw.
 */
export async function POST(req: NextRequest) {
  // Degrade like every other webhook rather than throwing: the secret can't exist until
  // the endpoint is created in the Clerk dashboard, and ensureUser() covers the mirror
  // until it is.
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
    console.warn('[clerk-webhook] event received but CLERK_WEBHOOK_SIGNING_SECRET is not set')
    return new Response('Clerk webhooks not configured', { status: 503 })
  }

  let evt: Awaited<ReturnType<typeof verifyWebhook>>

  try {
    evt = await verifyWebhook(req)
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (evt.type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, primary_email_address_id, first_name, last_name, public_metadata } =
          evt.data

        const email =
          email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
          email_addresses[0]?.email_address

        if (!email) {
          // Nothing to mirror without an email, and retrying won't produce one.
          console.warn(`[clerk-webhook] ${evt.type} for ${id} has no email; skipping`)
          return new Response('ok (no email)', { status: 200 })
        }

        const fullName = [first_name, last_name].filter(Boolean).join(' ') || null
        const role = (public_metadata?.role as Role | undefined) ?? 'student'

        await db
          .insert(users)
          .values({ clerkId: id, email, fullName, role })
          .onConflictDoUpdate({
            target: users.clerkId,
            set: { email, fullName, role },
          })

        break
      }

      case 'user.deleted': {
        const { id } = evt.data
        if (id) {
          // Hard delete. FKs from sessions/links use onDelete: 'restrict', so this
          // throws for a user with transaction history rather than silently orphaning
          // or destroying financial records — which is the behavior we want. Handling
          // that case (anonymize vs. suspend) is a Phase 1 decision, not a Phase 0 one.
          await db.delete(users).where(eq(users.clerkId, id))
        }
        break
      }

      default:
        // Subscribed to more event types than we handle? Ack rather than retry forever.
        break
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(`[clerk-webhook] handler failed for ${evt.type}`, err)
    return new Response('Handler error', { status: 500 })
  }
}
