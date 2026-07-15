import { Card } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/guards'
import { listNotifications, markAllRead } from '@/lib/notifications'

export const metadata = { title: 'Notifications' }
export const dynamic = 'force-dynamic'

const LABELS: Record<string, string> = {
  booking_confirmed: 'Session booked',
  payment_received: 'Payment received',
  session_canceled: 'Session canceled',
  session_reminder: 'Session reminder',
  coach_approved: 'Profile approved',
  coach_rejected: 'Application update',
  new_report: 'New report filed',
}

/**
 * Spec §12 — the in-app notification list. This is the DURABLE record: it's written even
 * when Resend is unconfigured or fails, which is why email is best-effort.
 */
export default async function NotificationsPage() {
  const user = await requireUser()

  const items = await listNotifications(user.id)

  // Viewing the list is what marks it read. Done after the read so the unread ones can
  // still be styled on this render.
  const unreadIds = new Set(items.filter((i) => !i.readAt).map((i) => i.id))
  if (unreadIds.size) await markAllRead(user.id)

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14">
      <p className="label-mono">Activity</p>
      <h1 className="mt-3 text-4xl">Notifications</h1>

      {items.length === 0 ? (
        <Card className="mt-8 border-line/20 p-10 text-center">
          <p className="text-slate">Nothing yet.</p>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`border-line/20 p-4 ${unreadIds.has(n.id) ? 'border-gold' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm">{LABELS[n.type] ?? n.type}</p>
                <time
                  dateTime={n.createdAt.toISOString()}
                  className="shrink-0 font-mono text-[11px] text-slate"
                >
                  {n.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}
                </time>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
