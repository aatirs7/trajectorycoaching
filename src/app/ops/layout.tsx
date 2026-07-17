import { ConsoleShell } from '@/components/console-shell'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * /ops is now FOUNDERS-ONLY (it was public). Same gate and frame as /admin, so the ops
 * board and the admin views are one console. The `// TODO: gate to admin` from the ops
 * spec is resolved here.
 */
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <ConsoleShell>{children}</ConsoleShell>
}
