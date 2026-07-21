'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import { createExpense, deleteExpense, type ExpenseState, setReimbursed, updateExpense } from './actions'
import { ConsoleHeader } from '@/components/console-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  byCategory,
  byMonth,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYERS,
  formatCents,
  formatCentsShort,
  formatDay,
  monthKey,
  monthLabel,
  owedToFounders,
  previousMonthKey,
  toCsv,
  totalCents,
} from '@/lib/expenses'

export type ExpenseView = {
  id: string
  spentOn: string
  description: string
  vendor: string | null
  amountCents: number
  category: string
  paidBy: string
  /** ISO string, or null when still outstanding. */
  reimbursedAt: string | null
  notes: string | null
  receiptUrl: string | null
}

const ALL = 'All'

/** Shared field styling — the native selects have to sit next to shadcn Inputs. */
const SELECT =
  'h-9 w-full rounded-md border border-line/25 bg-paper px-3 text-sm text-ink transition-colors focus-visible:border-gold focus-visible:outline-none'

const FILTER_SELECT =
  'h-9 rounded-md border border-line/25 bg-paper px-3 text-sm text-ink transition-colors focus-visible:border-gold focus-visible:outline-none'

export function ExpenseTracker({
  expenses,
  today,
}: {
  expenses: ExpenseView[]
  today: string
}) {
  const [monthFilter, setMonthFilter] = useState<string>(ALL)
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL)
  const [payerFilter, setPayerFilter] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const thisMonth = monthKey(today)
  const lastMonth = previousMonthKey(thisMonth)

  /**
   * The headline tiles are deliberately computed over ALL expenses, never the filtered
   * set. "This month" has to mean this month — a tile that quietly re-scoped itself when
   * a filter was set would be the kind of number you'd trust and shouldn't.
   */
  const headline = useMemo(() => {
    const inMonth = (key: string) => expenses.filter((e) => monthKey(e.spentOn) === key)
    return {
      thisMonth: totalCents(inMonth(thisMonth)),
      lastMonth: totalCents(inMonth(lastMonth)),
      allTime: totalCents(expenses),
      owed: owedToFounders(expenses),
    }
  }, [expenses, thisMonth, lastMonth])

  const months = useMemo(() => byMonth(expenses), [expenses])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return expenses.filter((e) => {
      if (monthFilter !== ALL && monthKey(e.spentOn) !== monthFilter) return false
      if (categoryFilter !== ALL && e.category !== categoryFilter) return false
      if (payerFilter !== ALL && e.paidBy !== payerFilter) return false
      if (!q) return true
      return (
        e.description.toLowerCase().includes(q) ||
        (e.vendor ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q)
      )
    })
  }, [expenses, monthFilter, categoryFilter, payerFilter, query])

  const categories = useMemo(() => byCategory(filtered), [filtered])
  const filteredTotal = totalCents(filtered)

  /** The ledger, grouped into month sections with their own subtotals. */
  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseView[]>()
    for (const e of filtered) {
      const key = monthKey(e.spentOn)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, rows]) => ({ key, label: monthLabel(key), rows, total: totalCents(rows) }))
  }, [filtered])

  const filtersActive = monthFilter !== ALL || categoryFilter !== ALL || payerFilter !== ALL || query.trim() !== ''

  /**
   * The bar scale uses the largest POSITIVE category. Scaling to the largest absolute
   * value would let a big refund set the scale and squash every real cost next to it.
   */
  const barMax = Math.max(1, ...categories.map((c) => Math.max(0, c.totalCents)))

  function exportCsv() {
    const csv = toCsv(filtered)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `mentorreach-expenses-${monthFilter === ALL ? 'all' : monthFilter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <ConsoleHeader
        title="Expenses"
        description="Everything the business has spent, what it went on, and who is owed it back."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => setAdding((a) => !a)}>{adding ? 'Close' : 'Log an expense'}</Button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filtered.length}
              className="text-sm text-slate underline decoration-gold underline-offset-4 transition-colors hover:text-ink disabled:no-underline disabled:opacity-40"
            >
              Export {filtersActive ? 'these' : 'all'} as CSV
            </button>
          </div>
        }
      />

      {/* ------------------------------------------------------------ headline */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={monthLabel(thisMonth)} value={headline.thisMonth} hint="This month" />
        <Tile label={monthLabel(lastMonth)} value={headline.lastMonth} hint="Last month" />
        <Tile label="All time" value={headline.allTime} hint={`${expenses.length} entries`} />

        <Card className="border-line/20 bg-raised p-5">
          <p className="label-mono">Owed back</p>
          {headline.owed.length ? (
            <ul className="mt-2 space-y-1">
              {headline.owed.map((o) => (
                <li key={o.payer} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-slate">{o.payer}</span>
                  <span className="font-display text-xl tabular-nums">{formatCentsShort(o.cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-display text-2xl text-ink">Nothing</p>
          )}
          <p className="mt-2 text-xs text-slate">Paid personally, not yet reimbursed.</p>
        </Card>
      </div>

      {/* ----------------------------------------------------------- add form */}
      {adding || !expenses.length ? (
        <AddForm today={today} onDone={() => setAdding(false)} empty={!expenses.length} />
      ) : null}

      {/* ------------------------------------------------------------ filters */}
      {expenses.length ? (
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className={FILTER_SELECT}
            aria-label="Filter by month"
          >
            <option value={ALL}>All months</option>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={FILTER_SELECT}
            aria-label="Filter by category"
          >
            <option value={ALL}>All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
            className={FILTER_SELECT}
            aria-label="Filter by who paid"
          >
            <option value={ALL}>Anyone paid</option>
            {EXPENSE_PAYERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description, vendor, notes"
            className="h-9 w-full max-w-xs"
            aria-label="Search expenses"
          />

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setMonthFilter(ALL)
                setCategoryFilter(ALL)
                setPayerFilter(ALL)
                setQuery('')
              }}
              className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
            >
              Clear
            </button>
          ) : null}

          <p className="ml-auto text-sm text-slate">
            <span className="font-display text-lg text-ink tabular-nums">{formatCents(filteredTotal)}</span>
            <span className="ml-2">
              across {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          </p>
        </div>
      ) : null}

      {/* -------------------------------------------------- category breakdown */}
      {categories.length ? (
        <Card className="mt-6 border-line/20 bg-raised p-6">
          <p className="label-mono">
            By category {monthFilter === ALL ? '· all time' : `· ${monthLabel(monthFilter)}`}
          </p>
          <ul className="mt-4 space-y-3">
            {categories.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => setCategoryFilter(categoryFilter === c.key ? ALL : c.key)}
                  className="group block w-full text-left"
                  aria-pressed={categoryFilter === c.key}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-ink transition-colors group-hover:text-gold">{c.label}</span>
                    <span className="shrink-0 text-sm text-slate tabular-nums">
                      {formatCents(c.totalCents)}
                      <span className="ml-2 text-xs">
                        {filteredTotal > 0 ? `${Math.round((c.totalCents / filteredTotal) * 100)}%` : ''}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-deep">
                    <div
                      className="h-full rounded-full bg-gold transition-all"
                      style={{ width: `${Math.max(0, (c.totalCents / barMax) * 100)}%` }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------- ledger */}
      {expenses.length && !filtered.length ? (
        <p className="mt-10 text-center text-sm text-slate">
          Nothing matches those filters.
        </p>
      ) : null}

      <div className="mt-10 space-y-10">
        {grouped.map((group) => (
          <section key={group.key}>
            <div className="flex items-baseline justify-between gap-4 border-b border-line/20 pb-2">
              <h2 className="font-display text-xl">{group.label}</h2>
              <span className="text-sm text-slate tabular-nums">
                {formatCents(group.total)}
                <span className="ml-2 text-xs">
                  · {group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}
                </span>
              </span>
            </div>

            <ul>
              {group.rows.map((e) =>
                editing === e.id ? (
                  <li key={e.id} className="border-b border-line/12 py-4">
                    <EditForm expense={e} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <li
                    key={e.id}
                    className="group flex items-baseline gap-4 border-b border-line/12 py-3 text-sm"
                  >
                    <span className="w-14 shrink-0 font-mono text-xs text-slate tabular-nums">
                      {formatDay(e.spentOn)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="text-ink">{e.description}</span>
                      {e.vendor ? <span className="text-slate"> · {e.vendor}</span> : null}
                      {e.notes ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate">{e.notes}</span>
                      ) : null}
                      {e.receiptUrl ? (
                        <a
                          href={e.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block text-xs text-slate underline decoration-gold underline-offset-2 hover:text-ink"
                        >
                          Receipt
                        </a>
                      ) : null}
                    </span>

                    <span className="hidden shrink-0 text-xs text-slate sm:block">{e.category}</span>

                    <span className="w-20 shrink-0 text-right">
                      <PayerBadge
                        payer={e.paidBy}
                        reimbursed={Boolean(e.reimbursedAt)}
                        onToggle={
                          e.paidBy === 'Business'
                            ? undefined
                            : () => start(() => void setReimbursed(e.id, !e.reimbursedAt))
                        }
                      />
                    </span>

                    <span
                      className={`w-24 shrink-0 text-right tabular-nums ${
                        e.amountCents < 0 ? 'text-[#3f6b4f]' : 'text-ink'
                      }`}
                    >
                      {formatCents(e.amountCents)}
                    </span>

                    <span className="flex w-16 shrink-0 justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditing(e.id)}
                        className="text-xs text-slate hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${e.description}"?`)) start(() => void deleteExpense(e.id))
                        }}
                        disabled={pending}
                        className="text-xs text-slate hover:text-destructive"
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}

function Tile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="border-line/20 bg-raised p-5">
      <p className="label-mono">{hint}</p>
      <p className="mt-2 font-display text-3xl text-ink tabular-nums">{formatCentsShort(value)}</p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </Card>
  )
}

/**
 * Who paid, and — for personally-paid rows — whether it has been settled. Clicking
 * toggles it. 'Business' has no toggle because the business cannot owe itself; the
 * control is absent rather than disabled, since a disabled control invites the question.
 */
function PayerBadge({
  payer,
  reimbursed,
  onToggle,
}: {
  payer: string
  reimbursed: boolean
  onToggle?: () => void
}) {
  const base = 'rounded px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase'

  if (!onToggle) {
    return <span className={`${base} border border-line/25 text-slate`}>{payer}</span>
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      title={reimbursed ? `${payer} — reimbursed. Click to reopen.` : `${payer} — owed back. Click to settle.`}
      className={`${base} transition-colors ${
        reimbursed
          ? 'border border-line/25 text-slate line-through hover:text-ink'
          : 'bg-gold/15 text-[#8a6524] hover:bg-gold/25'
      }`}
    >
      {payer}
    </button>
  )
}

/** The shared field set, used by both the add and the edit form. */
function Fields({ expense, today }: { expense?: ExpenseView; today?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-12">
        <label className="sm:col-span-2">
          <span className="label-mono">Date</span>
          <Input
            type="date"
            name="spentOn"
            defaultValue={expense?.spentOn ?? today}
            required
            className="mt-1.5 h-9"
          />
        </label>

        <label className="sm:col-span-4">
          <span className="label-mono">What was it for</span>
          <Input
            name="description"
            defaultValue={expense?.description ?? ''}
            placeholder="LLC filing fee"
            required
            className="mt-1.5 h-9"
          />
        </label>

        <label className="sm:col-span-3">
          <span className="label-mono">Vendor</span>
          <Input
            name="vendor"
            defaultValue={expense?.vendor ?? ''}
            placeholder="Virginia SCC"
            className="mt-1.5 h-9"
          />
        </label>

        <label className="sm:col-span-3">
          <span className="label-mono">Amount</span>
          <Input
            name="amount"
            defaultValue={expense ? (expense.amountCents / 100).toFixed(2) : ''}
            placeholder="100.00"
            inputMode="decimal"
            required
            className="mt-1.5 h-9"
          />
        </label>

        <label className="sm:col-span-4">
          <span className="label-mono">Category</span>
          <select name="category" defaultValue={expense?.category ?? 'Software & Tools'} className={`${SELECT} mt-1.5`}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="sm:col-span-3">
          <span className="label-mono">Paid by</span>
          <select name="paidBy" defaultValue={expense?.paidBy ?? 'Aatir'} className={`${SELECT} mt-1.5`}>
            {EXPENSE_PAYERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="sm:col-span-5">
          <span className="label-mono">Receipt link</span>
          <Input
            name="receiptUrl"
            type="url"
            defaultValue={expense?.receiptUrl ?? ''}
            placeholder="https://…"
            className="mt-1.5 h-9"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="label-mono">Notes</span>
        <Textarea
          name="notes"
          defaultValue={expense?.notes ?? ''}
          rows={2}
          placeholder="Anything worth remembering at tax time."
          className="mt-1.5"
        />
      </label>
    </>
  )
}

function AddForm({ today, onDone, empty }: { today: string; onDone: () => void; empty: boolean }) {
  const [state, action, pending] = useActionState(
    async (_prev: ExpenseState, fd: FormData) => {
      const result = await createExpense(fd)
      if (result.ok) onDone()
      return result
    },
    {} as ExpenseState,
  )

  /**
   * `key` on the form resets every uncontrolled field after a successful save, so the
   * next expense starts from a clean form instead of the last one's values. Cheaper and
   * less error-prone than making nine fields controlled just to clear them.
   */
  return (
    <Card className="mt-8 border-line/20 bg-raised p-6">
      <p className="label-mono">{empty ? 'Log your first expense' : 'New expense'}</p>
      <form key={state.ok ? 'saved' : 'draft'} action={action} className="mt-4">
        <Fields today={today} />
        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save expense'}
          </Button>
          {!empty ? (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <p className="ml-auto text-xs text-slate">A refund or credit goes in as a negative amount.</p>
        </div>
      </form>
    </Card>
  )
}

function EditForm({ expense, onDone }: { expense: ExpenseView; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (_prev: ExpenseState, fd: FormData) => {
      const result = await updateExpense(fd)
      if (result.ok) onDone()
      return result
    },
    {} as ExpenseState,
  )

  return (
    <form action={action}>
      <input type="hidden" name="id" value={expense.id} />
      <Fields expense={expense} />
      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </div>
    </form>
  )
}
