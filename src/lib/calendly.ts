import 'server-only'
import { env, requireEnv } from './env'

/**
 * Spec §9 — Calendly.
 *
 * ACCOUNT MODEL: Trajectory owns a Calendly Teams org. Each approved coach is a host
 * with event types matching their offered lengths (30/45/60). API access and webhooks
 * stay centralized under one account rather than scattered across coaches' personal
 * Calendlys.
 *
 * CORRELATION (the important bit): we mint a single-use scheduling link carrying
 * `utm_content=<session_id>`. Calendly echoes it back in the invitee.created payload
 * under `tracking.utm_content`. That is the join key back to the sessions row.
 *
 * No SDK — plain fetch against api.calendly.com. Every call goes through `calendlyFetch`
 * so auth and error handling exist in exactly one place.
 */
const API = 'https://api.calendly.com'

export function calendlyConfigured(): boolean {
  return Boolean(env.CALENDLY_API_TOKEN && env.CALENDLY_ORGANIZATION_URI)
}

async function calendlyFetch<T>(
  path: string,
  init?: RequestInit & { body?: string },
): Promise<T> {
  const token = requireEnv('CALENDLY_API_TOKEN', 'Calendly scheduling')

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Calendly ${init?.method ?? 'GET'} ${path} failed: ${res.status} ${body}`)
  }

  return res.json() as Promise<T>
}

export type CalendlyEventType = {
  uri: string
  name: string
  duration: number
  active: boolean
  scheduling_url: string
}

/** The event types a coach hosts, used to match a booking's length to a Calendly link. */
export async function listEventTypes(userUri: string): Promise<CalendlyEventType[]> {
  const data = await calendlyFetch<{ collection: CalendlyEventType[] }>(
    `/event_types?user=${encodeURIComponent(userUri)}&active=true&count=100`,
  )
  return data.collection
}

/** Find the coach's event type matching an offering length (30/45/60). */
export async function findEventTypeByDuration(
  userUri: string,
  minutes: number,
): Promise<CalendlyEventType | null> {
  const types = await listEventTypes(userUri)
  return types.find((t) => t.duration === minutes && t.active) ?? null
}

/**
 * Spec §8 step 3 — mint a SINGLE-USE scheduling link for one paid session.
 *
 * Single-use matters: the student paid for exactly one session, so the link must not be
 * reusable to book a second. Calendly enforces that server-side.
 *
 * The utm_content param is what the invitee.created webhook echoes back, and is the only
 * thing tying a Calendly booking to our sessions row. Do not remove it.
 */
export async function createSingleUseSchedulingLink(params: {
  eventTypeUri: string
  sessionId: string
}): Promise<string> {
  const data = await calendlyFetch<{ resource: { booking_url: string } }>('/scheduling_links', {
    method: 'POST',
    body: JSON.stringify({
      max_event_count: 1,
      owner: params.eventTypeUri,
      owner_type: 'EventType',
    }),
  })

  const url = new URL(data.resource.booking_url)
  url.searchParams.set('utm_content', params.sessionId)

  return url.toString()
}

export type CalendlyUser = { uri: string; name: string; email: string }

/** Look up an org member by email, to capture their host URI at approval time. */
export async function findOrgMemberByEmail(email: string): Promise<CalendlyUser | null> {
  const org = requireEnv('CALENDLY_ORGANIZATION_URI', 'Calendly scheduling')

  const data = await calendlyFetch<{
    collection: Array<{ user: CalendlyUser }>
  }>(`/organization_memberships?organization=${encodeURIComponent(org)}&email=${encodeURIComponent(email)}&count=10`)

  return data.collection[0]?.user ?? null
}

/** Invite a newly approved coach into the Trajectory Calendly org (§9). */
export async function inviteToOrganization(email: string): Promise<void> {
  const org = requireEnv('CALENDLY_ORGANIZATION_URI', 'Calendly scheduling')

  await calendlyFetch(`/organizations/${orgId(org)}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

/** Cancel a scheduled Calendly event (used when we cancel from our side). */
export async function cancelEvent(eventUri: string, reason: string): Promise<void> {
  await calendlyFetch(`/scheduled_events/${uuidFromUri(eventUri)}/cancellation`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/**
 * Register the invitee.created / invitee.canceled subscription (§9).
 * Run once per environment; safe to re-run (Calendly 409s on duplicates).
 */
export async function ensureWebhookSubscription(): Promise<{ created: boolean; uri?: string }> {
  const org = requireEnv('CALENDLY_ORGANIZATION_URI', 'Calendly scheduling')
  const signingKey = requireEnv('CALENDLY_WEBHOOK_SIGNING_KEY', 'Calendly webhooks')

  try {
    const data = await calendlyFetch<{ resource: { uri: string } }>('/webhook_subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/calendly`,
        events: ['invitee.created', 'invitee.canceled'],
        organization: org,
        scope: 'organization',
        signing_key: signingKey,
      }),
    })
    return { created: true, uri: data.resource.uri }
  } catch (err) {
    if (err instanceof Error && err.message.includes('409')) return { created: false }
    throw err
  }
}

/** Calendly URIs are `https://api.calendly.com/<collection>/<uuid>`. */
export function uuidFromUri(uri: string): string {
  return uri.split('/').pop() ?? ''
}

function orgId(orgUri: string): string {
  return uuidFromUri(orgUri)
}
