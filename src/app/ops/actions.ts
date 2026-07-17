'use server'

import { asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tasks } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { OPS_SEED } from '@/lib/ops-seed'
import { isCategory, isOwner, isStatus, OPS_CATEGORIES } from '@/lib/ops-schema'

/**
 * Founders-only. The /ops layout gates the pages, but a Server Action is a POST that can
 * be called directly, so each mutation re-checks with requireAdmin(). seedOpsBoard is the
 * exception: it's a no-op-if-not-empty insert invoked from the (already gated) page render.
 */

export type OpsState = { error?: string }

/** Seed the board once, only if empty, so live edits are never clobbered by a reseed. */
export async function seedOpsBoard(): Promise<void> {
  const existing = await db.select({ id: tasks.id }).from(tasks).limit(1)
  if (existing.length) return

  const rows: (typeof tasks.$inferInsert)[] = []
  for (const category of OPS_CATEGORIES) {
    OPS_SEED[category].forEach((t, i) => {
      rows.push({
        title: t.title,
        details: t.details ?? null,
        category,
        owner: t.owner,
        status: t.status,
        thisWeek: t.thisWeek ?? false,
        sortOrder: i,
        completedAt: t.status === 'done' ? new Date() : null,
      })
    })
  }

  if (rows.length) await db.insert(tasks).values(rows)
}

export async function createTask(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  const category = formData.get('category')
  const owner = formData.get('owner') ?? 'Unassigned'
  const details = String(formData.get('details') ?? '').trim()

  if (!title) return { error: 'A title is required.' }
  if (!isCategory(category)) return { error: 'Unknown category.' }
  if (!isOwner(owner)) return { error: 'Unknown owner.' }

  // New tasks go to the bottom of their category.
  const [{ max } = { max: -1 }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${tasks.sortOrder}), -1)::int` })
    .from(tasks)
    .where(eq(tasks.category, category))

  await db.insert(tasks).values({
    title,
    details: details || null,
    category,
    owner,
    sortOrder: (max ?? -1) + 1,
  })

  revalidatePath('/ops')
  return {}
}

export async function updateTask(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const details = String(formData.get('details') ?? '').trim()
  const owner = formData.get('owner')

  if (!id) return { error: 'Missing task.' }
  if (!title) return { error: 'A title is required.' }
  if (owner !== null && owner !== undefined && !isOwner(owner)) return { error: 'Unknown owner.' }

  await db
    .update(tasks)
    .set({
      title,
      details: details || null,
      ...(isOwner(owner) ? { owner } : {}),
    })
    .where(eq(tasks.id, id))

  revalidatePath('/ops')
  return {}
}

export async function setTaskStatus(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const status = formData.get('status')

  if (!id) return { error: 'Missing task.' }
  if (!isStatus(status)) return { error: 'Unknown status.' }

  await db
    .update(tasks)
    // completed_at tracks the done state both ways, per the spec.
    .set({ status, completedAt: status === 'done' ? new Date() : null })
    .where(eq(tasks.id, id))

  revalidatePath('/ops')
  return {}
}

export async function toggleThisWeek(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing task.' }

  const row = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (!row) return { error: 'Task not found.' }

  await db.update(tasks).set({ thisWeek: !row.thisWeek }).where(eq(tasks.id, id))

  revalidatePath('/ops')
  return {}
}

export async function deleteTask(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing task.' }

  await db.delete(tasks).where(eq(tasks.id, id))

  revalidatePath('/ops')
  return {}
}

/** Nudge a task up or down within its category (simple reorder, not full drag). */
export async function moveTask(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const dir = formData.get('dir')
  if (!id || (dir !== 'up' && dir !== 'down')) return { error: 'Bad move.' }

  const row = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (!row) return { error: 'Task not found.' }

  const siblings = await db
    .select()
    .from(tasks)
    .where(eq(tasks.category, row.category))
    .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt))

  const idx = siblings.findIndex((s) => s.id === id)
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= siblings.length) return {}

  const other = siblings[swapIdx]
  // Swap sort_order with the neighbour.
  await db.batch([
    db.update(tasks).set({ sortOrder: other.sortOrder }).where(eq(tasks.id, row.id)),
    db.update(tasks).set({ sortOrder: row.sortOrder }).where(eq(tasks.id, other.id)),
  ])

  revalidatePath('/ops')
  return {}
}
