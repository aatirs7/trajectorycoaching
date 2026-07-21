import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Internal ops board (the shared Aatir/Isaiah to-do list at /ops). DB-backed on purpose:
 * two people share it, so it can't live in localStorage.
 *
 * `category`, `owner`, and `status` are plain `text` with app-validated value sets rather
 * than pg enums — this is an internal tool whose categories/owners will churn, and a
 * migration per new value would be silly. Values are constrained in src/lib/ops-schema.ts.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    /** Optional longer note (emails, context). */
    details: text('details'),
    category: text('category').notNull(),
    owner: text('owner').notNull(),
    status: text('status').notNull().default('todo'),
    /** Focus flag — starred tasks surface in the pinned "This week" strip. */
    thisWeek: boolean('this_week').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** Set when status → done, cleared otherwise. */
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    /**
     * Who actually ticked it off, captured from the signed-in founder — NOT the same
     * question as `owner`, which is whose job it is.
     *
     * They diverge in the two cases the overview has to get right: a task owned by
     * "Both" has no attribution at all without this, and either founder can close the
     * other's task. Crediting completion to `owner` would then quietly assign work to
     * someone who didn't do it, which defeats the point of the dashboard.
     *
     * Nullable, and null for everything completed before this column existed.
     */
    completedBy: text('completed_by'),
  },
  (t) => [index('tasks_category_sort_idx').on(t.category, t.sortOrder)],
)
