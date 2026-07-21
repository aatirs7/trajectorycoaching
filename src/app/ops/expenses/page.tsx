import { desc } from 'drizzle-orm'
import { ExpenseTracker, type ExpenseView } from './expense-tracker'
import { db } from '@/db'
import { expenses } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { businessToday } from '@/lib/expenses'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Expenses', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * The business expense ledger — founders-only, gated by ../layout.tsx and again by every
 * action in ./actions.ts.
 *
 * The whole table is sent to the client and all filtering/summarising happens there. That
 * is a deliberate choice for THIS table and not a general pattern: it is two people
 * logging company costs, so it is hundreds of rows over a year, not millions. Holding
 * them all client-side makes switching month, category and payer instant with no server
 * round-trip, and every summary is computed by the same pure functions the tests cover.
 * If this ever reached tens of thousands of rows the aggregation would move into SQL.
 */
export default async function ExpensesPage() {
  await requireAdmin()

  const rows = await db.select().from(expenses).orderBy(desc(expenses.spentOn), desc(expenses.createdAt))

  /**
   * `reimbursedAt` is serialised to an ISO string rather than passed as a Date. Dates do
   * survive the server/client boundary, but the client only ever asks "is this set?" and
   * formats it — a string keeps the prop payload honest about what is actually used.
   */
  const view: ExpenseView[] = rows.map((e) => ({
    id: e.id,
    spentOn: e.spentOn,
    description: e.description,
    vendor: e.vendor,
    amountCents: e.amountCents,
    category: e.category,
    paidBy: e.paidBy,
    reimbursedAt: e.reimbursedAt ? e.reimbursedAt.toISOString() : null,
    notes: e.notes,
    receiptUrl: e.receiptUrl,
  }))

  // Computed on the server in the business timezone, then passed down, so the "this
  // month" tiles and the new-expense date default agree between server and client — see
  // businessToday(). A client-side new Date() here would risk a hydration mismatch.
  return <ExpenseTracker expenses={view} today={businessToday()} />
}
