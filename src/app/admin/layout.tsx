import { ConsoleShell } from '@/components/console-shell'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Gates the whole /admin area to founders (admins) and wraps it in the shared console
 * frame. requireAdmin() runs for every nested admin page.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <ConsoleShell>{children}</ConsoleShell>
}
