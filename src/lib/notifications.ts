import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { ReactElement } from 'react'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { sendEmail } from './email/client'

/**
 * Spec §12 — notifications are an in-app row PLUS a Resend email.
 *
 * The row is the durable record and is written first; the email is best-effort. If
 * Resend is unconfigured or down, the user still sees the notification in-app. Real-time
 * is explicitly not required for v1.
 */
export type NotificationType =
  | 'booking_confirmed'
  | 'payment_received'
  | 'session_canceled'
  | 'session_reminder'
  | 'coach_approved'
  | 'coach_rejected'
  | 'new_report'

export async function notify(params: {
  userId: string
  type: NotificationType
  payload?: Record<string, unknown>
  email?: { to: string; subject: string; react: ReactElement }
}): Promise<void> {
  // In-app row first: this is the record that must survive an email failure.
  await db.insert(notifications).values({
    userId: params.userId,
    type: params.type,
    payload: params.payload ?? {},
  })

  if (params.email) {
    // Deliberately not awaited into the caller's error path — sendEmail never throws.
    await sendEmail(params.email)
  }
}

export async function listNotifications(userId: string, limit = 30) {
  return db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit,
  })
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return rows.length
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}
