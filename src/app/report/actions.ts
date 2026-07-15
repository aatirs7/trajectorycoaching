'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { reports, sessions, users } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { NewReportEmail } from '@/lib/email/templates'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'

/** Open set by design — `text` in the DB, so adding a category isn't a migration. */
export const REPORT_CATEGORIES = [
  'Harassment or abuse',
  'Inappropriate behavior',
  'No-show',
  'Misrepresented experience',
  'Asked to pay off-platform',
  'Spam or scam',
  'Other',
] as const

export type ReportState = { error?: string; success?: string }

/**
 * Spec §12 — either party files a report; it lands in the admin review queue.
 *
 * Note "Asked to pay off-platform" as a first-class category: hard rule §2.1 says all
 * payment happens on-platform, and this is how we actually hear about violations.
 */
export async function submitReport(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const reporter = await requireUser()

  const reportedUserId = formData.get('reportedUserId')
  const category = formData.get('category')
  const description = formData.get('description')
  const sessionId = formData.get('sessionId')

  if (typeof reportedUserId !== 'string' || !reportedUserId) return { error: 'Missing user.' }
  if (typeof category !== 'string' || !REPORT_CATEGORIES.includes(category as never)) {
    return { error: 'Pick a category.' }
  }
  if (typeof description !== 'string' || description.trim().length < 10) {
    return { error: 'Please describe what happened (at least a sentence).' }
  }
  if (description.length > 5000) return { error: 'That description is too long.' }

  if (reportedUserId === reporter.id) return { error: 'You cannot report yourself.' }

  const reported = await db.query.users.findFirst({ where: eq(users.id, reportedUserId) })
  if (!reported) return { error: 'That user does not exist.' }

  // If a session is cited, the reporter must actually be part of it — otherwise anyone
  // could attach a report to an arbitrary session id.
  let validSessionId: string | null = null
  if (typeof sessionId === 'string' && sessionId) {
    const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
    if (session && (session.studentId === reporter.id || session.coachId === reporter.id)) {
      validSessionId = session.id
    }
  }

  const [created] = await db
    .insert(reports)
    .values({
      reporterId: reporter.id,
      reportedUserId,
      sessionId: validSessionId,
      category,
      description: description.trim(),
    })
    .returning()

  // §12 — notify admins so the queue isn't purely pull-based.
  const admins = await db.query.users.findMany({ where: eq(users.role, 'admin') })

  await Promise.all(
    admins.map((admin) =>
      notify({
        userId: admin.id,
        type: 'new_report',
        payload: { reportId: created.id, category },
        email: {
          to: admin.email,
          subject: `New report: ${category}`,
          react: NewReportEmail({
            reportId: created.id,
            category,
            reportedUserName: reported.fullName ?? reported.email,
            adminUrl: `${env.NEXT_PUBLIC_APP_URL}/admin/reports`,
          }),
        },
      }),
    ),
  )

  return { success: 'Thanks, we’ve got it. Our team will review this and follow up.' }
}
