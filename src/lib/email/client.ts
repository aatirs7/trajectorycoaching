import 'server-only'
import { Resend } from 'resend'
import type { ReactElement } from 'react'
import { env } from '../env'

/**
 * Spec §12 — transactional email via Resend.
 *
 * DESIGN DECISION: email is best-effort and NEVER throws into a caller. A booking must
 * not fail because a receipt couldn't be sent — the money already moved and the session
 * row already exists. Failures are logged, and the in-app notification (which is written
 * in the same flow) remains the durable record.
 *
 * Without RESEND_API_KEY the send is skipped and logged. That keeps the whole platform
 * usable before the account exists, which is the point.
 */
let client: Resend | null = null

function resend(): Resend | null {
  if (!env.RESEND_API_KEY) return null
  if (!client) client = new Resend(env.RESEND_API_KEY)
  return client
}

export function emailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)
}

export async function sendEmail(params: {
  to: string
  subject: string
  react: ReactElement
}): Promise<{ sent: boolean; reason?: string }> {
  const c = resend()

  if (!c || !env.EMAIL_FROM) {
    console.info(
      `[email] skipped "${params.subject}" → ${params.to} (Resend not configured; ` +
        `set RESEND_API_KEY and EMAIL_FROM to enable)`,
    )
    return { sent: false, reason: 'not_configured' }
  }

  try {
    const { error } = await c.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      react: params.react,
    })

    if (error) {
      console.error(`[email] send failed "${params.subject}" → ${params.to}`, error)
      return { sent: false, reason: error.message }
    }

    return { sent: true }
  } catch (err) {
    console.error(`[email] threw for "${params.subject}" → ${params.to}`, err)
    return { sent: false, reason: 'exception' }
  }
}
