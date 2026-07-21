'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { expenses } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { isExpenseCategory, isExpensePayer, parseAmountToCents } from '@/lib/expenses'

/**
 * Founders-only. ../layout.tsx gates the pages, but a Server Action is a POST to whatever
 * route it lives on and can be called without ever rendering the page, so every mutation
 * re-checks independently. Same reasoning as ../actions.ts on the ops board.
 */

export type ExpenseState = { error?: string; ok?: boolean }

/** 'YYYY-MM-DD' and a real calendar date — rejects '2026-02-31' as well as 'banana'. */
function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  if (m! < 1 || m! > 12 || d! < 1) return false
  // Day 0 of the next month is the last day of this one.
  return d! <= new Date(Date.UTC(y!, m!, 0)).getUTCDate()
}

/** Trim, and collapse an empty string to null so the column holds NULL rather than ''. */
function optional(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s || null
}

export async function createExpense(formData: FormData): Promise<ExpenseState> {
  const admin = await requireAdmin()

  const description = String(formData.get('description') ?? '').trim()
  const spentOn = String(formData.get('spentOn') ?? '').trim()
  const rawAmount = String(formData.get('amount') ?? '').trim()
  const category = formData.get('category')
  const paidBy = formData.get('paidBy')

  if (!description) return { error: 'What was it for?' }
  if (!isValidDate(spentOn)) return { error: 'Pick a valid date.' }
  if (!isExpenseCategory(category)) return { error: 'Unknown category.' }
  if (!isExpensePayer(paidBy)) return { error: 'Unknown payer.' }

  const amountCents = parseAmountToCents(rawAmount)
  if (amountCents === null) return { error: 'Amount should look like 49.99 (or -49.99 for a refund).' }
  // The CHECK constraint would reject this anyway; catching it here gives a real message
  // instead of a 500 from the driver.
  if (amountCents === 0) return { error: 'An amount of zero is not an expense.' }

  await db.insert(expenses).values({
    spentOn,
    description,
    vendor: optional(formData.get('vendor')),
    amountCents,
    category,
    paidBy,
    notes: optional(formData.get('notes')),
    receiptUrl: optional(formData.get('receiptUrl')),
    createdBy: admin.email ?? null,
  })

  revalidatePath('/ops/expenses')
  return { ok: true }
}

export async function updateExpense(formData: FormData): Promise<ExpenseState> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing expense.' }

  const description = String(formData.get('description') ?? '').trim()
  const spentOn = String(formData.get('spentOn') ?? '').trim()
  const rawAmount = String(formData.get('amount') ?? '').trim()
  const category = formData.get('category')
  const paidBy = formData.get('paidBy')

  if (!description) return { error: 'What was it for?' }
  if (!isValidDate(spentOn)) return { error: 'Pick a valid date.' }
  if (!isExpenseCategory(category)) return { error: 'Unknown category.' }
  if (!isExpensePayer(paidBy)) return { error: 'Unknown payer.' }

  const amountCents = parseAmountToCents(rawAmount)
  if (amountCents === null) return { error: 'Amount should look like 49.99 (or -49.99 for a refund).' }
  if (amountCents === 0) return { error: 'An amount of zero is not an expense.' }

  await db
    .update(expenses)
    .set({
      spentOn,
      description,
      vendor: optional(formData.get('vendor')),
      amountCents,
      category,
      paidBy,
      notes: optional(formData.get('notes')),
      receiptUrl: optional(formData.get('receiptUrl')),
    })
    .where(eq(expenses.id, id))

  revalidatePath('/ops/expenses')
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<void> {
  await requireAdmin()
  await db.delete(expenses).where(eq(expenses.id, id))
  revalidatePath('/ops/expenses')
}

/**
 * Mark a personally-paid expense as paid back, or undo that.
 *
 * Switching to 'Business' as the payer is NOT the same action and is left to the edit
 * form: 'Business' means the money never left a founder's pocket, whereas reimbursed
 * means it did and came back. Conflating them would lose the fact that a founder was out
 * of pocket for a period.
 */
export async function setReimbursed(id: string, reimbursed: boolean): Promise<void> {
  await requireAdmin()
  await db
    .update(expenses)
    .set({ reimbursedAt: reimbursed ? new Date() : null })
    .where(eq(expenses.id, id))
  revalidatePath('/ops/expenses')
}
