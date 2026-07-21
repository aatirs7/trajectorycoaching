import { sql } from 'drizzle-orm'
import { check, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Internal business expense ledger (/ops/expenses). Founders-only, like the ops board —
 * this is company bookkeeping, not marketplace data, and it deliberately has no
 * relationship to `sessions` or Stripe. Money flowing through the platform is revenue and
 * is already recorded on `sessions`; this table is money flowing OUT.
 *
 * `category` and `paid_by` are plain `text` with app-validated value sets rather than pg
 * enums, matching the ops board's reasoning (src/db/schema/tasks.ts): an internal tool's
 * categories churn, and a migration per new value is silly. Values live in
 * src/lib/expenses.ts.
 */
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * A CALENDAR date, not an instant — `date` with mode 'string', so it round-trips as
     * 'YYYY-MM-DD' and never moves.
     *
     * This is load-bearing for the monthly summary. A `timestamptz` would be rendered in
     * the viewer's timezone, so an expense logged late on the 31st in New York would fall
     * into the next month for anyone reading it further east — the totals would disagree
     * between the two founders' screens. A date has no timezone to disagree about, and
     * the month key is a string slice rather than a conversion.
     */
    spentOn: date('spent_on', { mode: 'string' }).notNull(),

    description: text('description').notNull(),
    /** Who it was paid to — "Namecheap", "Virginia SCC". Optional; not every spend has one. */
    vendor: text('vendor'),

    /**
     * Integer cents (hard rule — never float, never numeric).
     *
     * NEGATIVE IS LEGAL and means a refund or credit against a prior expense: a canceled
     * subscription, a duplicated charge reversed. That is why the CHECK is `<> 0` rather
     * than `> 0`. Every total in src/lib/expenses.ts is a plain sum, so a refund nets out
     * of its month and category on its own without any special-casing.
     */
    amountCents: integer('amount_cents').notNull(),

    category: text('category').notNull(),

    /**
     * Whose money actually left. Until the LLC has a bank account the founders are paying
     * personally, which makes "the business owes me this back" a real number they need —
     * it is the reimbursement total on the page. Once there is a business card, entries
     * become 'Business' and reimbursement stops applying to them.
     */
    paidBy: text('paid_by').notNull(),

    /**
     * Set when a personally-paid expense has been paid back. Null means outstanding.
     *
     * A timestamp rather than a boolean so the ledger records WHEN it was settled — at
     * tax time "was this reimbursed" and "in which year" are different questions.
     * Meaningless for `paid_by = 'Business'`, which is never owed back to anyone; the UI
     * only offers the control on personally-paid rows.
     */
    reimbursedAt: timestamp('reimbursed_at', { withTimezone: true, mode: 'date' }),

    notes: text('notes'),
    /**
     * A link to the receipt, pasted by hand (Drive, email, the vendor's invoice page).
     * Deliberately NOT an upload: blob storage is configured, but a receipt that lives in
     * one founder's Drive is already durable, and an upload flow is a bigger feature than
     * a text field. Column is here so adding uploads later is UI-only, not a migration.
     */
    receiptUrl: text('receipt_url'),

    /** Which founder logged it, for the audit trail — see `paid_by` for whose money it was. */
    createdBy: text('created_by'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The ledger is always read newest-first, and the summaries group by month, so the
    // date leads every query this table serves.
    index('expenses_spent_on_idx').on(t.spentOn),
    index('expenses_category_idx').on(t.category),
    check('expenses_amount_nonzero', sql`${t.amountCents} <> 0`),
  ],
)
