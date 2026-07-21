import { asc } from 'drizzle-orm'
import { OpsBoard, type OpsTaskView } from './board'
import { seedOpsBoard } from './actions'
import { db } from '@/db'
import { tasks } from '@/db/schema'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'MentorReach Ops', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Internal ops / to-do board (spec: replaces the Google Doc).
 *
 * Founders-only — the gate lives in ./layout.tsx, alongside the console frame, and every
 * server action re-checks it independently because an action is a POST that can be called
 * without ever rendering this page.
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
    parentId: t.parentId,
    title: t.title,
    details: t.details,
    category: t.category,
    owner: t.owner,
    status: t.status as OpsTaskView['status'],
    thisWeek: t.thisWeek,
  }))

  return <OpsBoard tasks={view} />
}
