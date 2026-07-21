'use server'

import { asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tasks } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { OPS_SEED } from '@/lib/ops-seed'
import { isCategory, isOwner, isStatus, OPS_CATEGORIES, OPS_OWNERS } from '@/lib/ops-schema'

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

/**
 * Resolve a requested parent to a legal one.
 *
 * The board renders exactly two levels, so a task parented to a CHILD would disappear
 * from every view — present in the database, invisible in the product. Rather than
 * rejecting that (the user's intent is obvious: "put this inside that group"), it walks
 * up to the top-level ancestor and nests there.
 *
 * Returns null for "no parent", and null for a parent id that doesn't exist.
 */
async function resolveParent(raw: FormDataEntryValue | null): Promise<string | null> {
  const id = String(raw ?? '').trim()
  if (!id || id === 'none') return null

  const parent = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (!parent) return null
  if (!parent.parentId) return parent.id

  const grandparent = await db.query.tasks.findFirst({ where: eq(tasks.id, parent.parentId) })
  return grandparent?.id ?? parent.id
}

export async function createTask(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  const category = formData.get('category')
  const owner = formData.get('owner') ?? 'Unassigned'
  const details = String(formData.get('details') ?? '').trim()
  const parentId = await resolveParent(formData.get('parentId'))

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
    parentId,
    sortOrder: (max ?? -1) + 1,
  })

  revalidatePath('/ops')
  revalidatePath('/ops/overview')
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

  /**
   * Re-parenting is part of the edit form, so an existing task can be filed into a
   * workstream after the fact — which is how grouping actually happens: you write the
   * task first and notice where it belongs later.
   *
   * A task cannot be nested under itself, and a task that already HAS children cannot be
   * nested under anything: doing either would create a level the views don't render, so
   * the group would vanish from the board with no visible cause.
   */
  let parentId = await resolveParent(formData.get('parentId'))
  if (parentId === id) parentId = null
  if (parentId) {
    const own = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.parentId, id)).limit(1)
    if (own.length) {
      return { error: 'That task has sub-tasks of its own, so it can’t be nested under another.' }
    }
  }

  await db
    .update(tasks)
    .set({
      title,
      details: details || null,
      parentId,
      ...(isOwner(owner) ? { owner } : {}),
    })
    .where(eq(tasks.id, id))

  revalidatePath('/ops')
  revalidatePath('/ops/overview')
  return {}
}

export async function setTaskStatus(formData: FormData): Promise<OpsState> {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const status = formData.get('status')

  if (!id) return { error: 'Missing task.' }
  if (!isStatus(status)) return { error: 'Unknown status.' }

  const done = status === 'done'

  await db
    .update(tasks)
    /**
     * completed_at and completed_by move together, in both directions. Clearing them on
     * un-done matters: a task reopened and finished again should read as completed by
     * whoever finished it the second time, not carry a stale first attempt.
     *
     * completed_by is the signed-in founder, matched to an OPS_OWNERS name so the
     * overview can group by it. It falls back to the raw name rather than dropping the
     * attribution, which is the more useful failure.
     */
    .set({
      status,
      completedAt: done ? new Date() : null,
      completedBy: done ? ownerNameFor(admin.fullName) : null,
    })
    .where(eq(tasks.id, id))

  revalidatePath('/ops')
  revalidatePath('/ops/overview')
  return {}
}

/** "Aatir Siddiqui" → "Aatir", so completions group under the same names as ownership. */
function ownerNameFor(fullName: string | null): string | null {
  if (!fullName) return null
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  const match = OPS_OWNERS.find((o) => o.toLowerCase() === first.toLowerCase())
  return match ?? fullName.trim()
}

/**
 * Change who owns a task, on its own.
 *
 * Separate from updateTask because that one is the edit FORM: it requires a title and
 * rewrites details, so reassigning from a dropdown through it would mean round-tripping
 * fields the user never opened. Owner is the field most often changed and least often
 * accompanied by anything else, so it gets a one-field action and an inline control.
 */
export async function setTaskOwner(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const owner = formData.get('owner')

  if (!id) return { error: 'Missing task.' }
  if (!isOwner(owner)) return { error: 'Unknown owner.' }

  await db.update(tasks).set({ owner }).where(eq(tasks.id, id))

  revalidatePath('/ops')
  revalidatePath('/ops/overview')
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
  revalidatePath('/ops/overview')
  return {}
}

export async function deleteTask(formData: FormData): Promise<OpsState> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing task.' }

  await db.delete(tasks).where(eq(tasks.id, id))

  revalidatePath('/ops')
  revalidatePath('/ops/overview')
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
  revalidatePath('/ops/overview')
  return {}
}
