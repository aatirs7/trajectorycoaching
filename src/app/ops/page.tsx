import { asc } from 'drizzle-orm'
import { OpsBoard, type OpsTaskView } from './board'
import { seedOpsBoard } from './actions'
import { db } from '@/db'
import { tasks } from '@/db/schema'

export const metadata = { title: 'MentorReach Ops' }
export const dynamic = 'force-dynamic'

/**
 * Internal ops / to-do board (spec: replaces the Google Doc).
 *
 * TODO: gate to admin. PUBLIC for now by design — wrap this in `await requireAdmin()`
 * (and add it to the actions) when the founders' accounts are set to admin. That's the
 * one-line change; nothing else here assumes public access.
 */
export default async function OpsPage() {
  // Seed on first load only (no-op once the table has rows), so the board is accurate
  // immediately without a manual seed step.
  await seedOpsBoard()

  const rows = await db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.category), asc(tasks.sortOrder), asc(tasks.createdAt))

  const view: OpsTaskView[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    details: t.details,
    category: t.category,
    owner: t.owner,
    status: t.status as OpsTaskView['status'],
    thisWeek: t.thisWeek,
  }))

  return <OpsBoard tasks={view} />
}
