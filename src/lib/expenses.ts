/**
 * The expense ledger's value sets, money parsing, and summary maths.
 *
 * Pure and I/O-free on purpose, like src/lib/commission.ts and src/lib/scheduler.ts, so
 * the arithmetic is unit-tested (./expenses.test.ts) rather than eyeballed on a page.
 * Nothing here imports the database or `server-only`, which is also what lets the client
 * component reuse the same formatting and totals the server computed.
 */

export const EXPENSE_CATEGORIES = [
  'Software & Tools',
  'Legal & Filing',
  'Domains & Hosting',
  'Marketing & Ads',
  'Contractors',
  'Banking & Fees',
  'Travel & Meals',
  'Equipment',
  'Other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/**
 * Whose money left. The two founders plus the business itself — see the `paid_by` comment
 * in src/db/schema/expenses.ts for why this exists at all (pre-LLC, they pay personally).
 */
export const EXPENSE_PAYERS = ['Aatir', 'Isaiah', 'Business'] as const
export type ExpensePayer = (typeof EXPENSE_PAYERS)[number]

export function isExpenseCategory(v: unknown): v is ExpenseCategory {
  return typeof v === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(v)
}

export function isExpensePayer(v: unknown): v is ExpensePayer {
  return typeof v === 'string' && (EXPENSE_PAYERS as readonly string[]).includes(v)
}

/**
 * Parse a typed dollar amount into integer cents, WITHOUT going through a float.
 *
 * `Math.round(parseFloat(x) * 100)` is the usual shortcut and it is wrong often enough to
 * matter: 8.87 * 100 is 886.9999999999999 in IEEE-754. Rounding rescues that particular
 * case, but the ledger sums hundreds of these and the CHECK constraints elsewhere in this
 * schema exist precisely because rounding cents eventually bites. Splitting on the decimal
 * point and doing integer arithmetic has no such failure mode.
 *
 * Accepts "75", "$75.50", "1,234.56", " 75.5 " and a leading "-" for a refund or credit
 * (see the `amount_cents` comment in the schema). Rejects anything else — including more
 * than two decimal places, which is a typo rather than a fraction of a cent.
 *
 * Returns null on anything unparseable so the caller can show a message; it never throws
 * and never silently returns 0, which would log a real expense as free.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null

  const [, sign, whole, frac = ''] = match
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null

  return sign === '-' ? -cents : cents
}

/**
 * Money for a ledger: always two decimal places.
 *
 * Deliberately unlike `formatPrice` in mentor-schema.ts, which drops ".00" because a
 * marketplace price reads better as "$75". A column of figures that has to add up reads
 * worse that way — "$75" and "$75.50" don't align, and a total that ends in .00 looks
 * like a different kind of number from the rows above it.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/** Compact form for the summary tiles, where "$1,240" beats "$1,240.00". */
export function formatCentsShort(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/**
 * 'YYYY-MM-DD' → 'YYYY-MM'.
 *
 * A string slice, NOT a Date conversion. `new Date('2026-07-31').getMonth()` is parsed as
 * UTC midnight and comes back as June for anyone west of Greenwich, which would file an
 * expense into the wrong month on one founder's screen and not the other's. There is no
 * timezone in the stored value and there must not be one here either.
 */
export function monthKey(spentOn: string): string {
  return spentOn.slice(0, 7)
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** 'YYYY-MM' → 'July 2026'. Built from the parts, for the same no-Date reason as above. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  const name = MONTH_NAMES[Number(month) - 1]
  return name ? `${name} ${year}` : key
}

/** 'YYYY-MM-DD' → 'Jul 3'. Year omitted — the month heading above it already says the year. */
export function formatDay(spentOn: string): string {
  const [, month, day] = spentOn.split('-')
  const name = MONTH_NAMES[Number(month) - 1]
  return name ? `${name.slice(0, 3)} ${Number(day)}` : spentOn
}

/** The minimum an expense needs for any of the maths below. */
export type ExpenseLike = {
  spentOn: string
  amountCents: number
  category: string
  paidBy: string
  reimbursedAt: Date | string | null
}

export type Bucket = {
  key: string
  label: string
  totalCents: number
  count: number
}

/**
 * Total per month, newest first.
 *
 * Months with no spend are absent rather than zero-filled: this is a ledger, and a gap in
 * it is true. Zero-filling would also require deciding where the series starts and ends,
 * which is a presentation question, not a data one.
 */
export function byMonth(expenses: readonly ExpenseLike[]): Bucket[] {
  const totals = new Map<string, { totalCents: number; count: number }>()

  for (const e of expenses) {
    const key = monthKey(e.spentOn)
    const bucket = totals.get(key) ?? { totalCents: 0, count: 0 }
    bucket.totalCents += e.amountCents
    bucket.count += 1
    totals.set(key, bucket)
  }

  return [...totals.entries()]
    .map(([key, v]) => ({ key, label: monthLabel(key), ...v }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

/**
 * Total per category, largest first.
 *
 * Every category that appears in the data gets a row, including ones that net to zero or
 * below after a refund — "we spent on this and got it back" is information, and dropping
 * the row would hide it.
 */
export function byCategory(expenses: readonly ExpenseLike[]): Bucket[] {
  const totals = new Map<string, { totalCents: number; count: number }>()

  for (const e of expenses) {
    const bucket = totals.get(e.category) ?? { totalCents: 0, count: 0 }
    bucket.totalCents += e.amountCents
    bucket.count += 1
    totals.set(e.category, bucket)
  }

  return [...totals.entries()]
    .map(([key, v]) => ({ key, label: key, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents)
}

export function totalCents(expenses: readonly ExpenseLike[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0)
}

/**
 * What the business still owes each founder: personally-paid, not yet reimbursed.
 *
 * 'Business' is excluded because the business cannot owe itself. Refunds count too — a
 * negative row reduces what is owed, which is correct: if Aatir paid $100 and $30 came
 * back to his card, he is out $70.
 */
export function owedToFounders(expenses: readonly ExpenseLike[]): { payer: string; cents: number }[] {
  const owed = new Map<string, number>()

  for (const e of expenses) {
    if (e.paidBy === 'Business' || e.reimbursedAt) continue
    owed.set(e.paidBy, (owed.get(e.paidBy) ?? 0) + e.amountCents)
  }

  return [...owed.entries()]
    .map(([payer, cents]) => ({ payer, cents }))
    .filter((r) => r.cents !== 0)
    .sort((a, b) => b.cents - a.cents)
}

/**
 * The company's timezone. The LLC is being formed in Virginia and both founders are
 * there, so this is where the business's day and month actually begin and end.
 */
export const BUSINESS_TZ = 'America/New_York'

/**
 * Today as 'YYYY-MM-DD' in the BUSINESS's timezone.
 *
 * Not the viewer's, and not UTC, for two separate reasons:
 *
 * - Accounting: "this month" is the company's month. If one founder travels, the ledger
 *   must not reclassify a spend into a different month because of where they opened it.
 * - Hydration: this is computed on the server and passed down as a prop. A viewer-local
 *   `new Date()` in a client component renders one string on the server and possibly
 *   another in the browser, which is a hydration mismatch on the date field for a few
 *   hours around midnight. Pinning the zone makes both sides agree by construction.
 *
 * `toISOString().slice(0, 10)` is the tempting one-liner and is wrong regardless — it is
 * UTC, so an expense logged on a Virginia evening lands on tomorrow's date. `en-CA`
 * formats as YYYY-MM-DD, which is what the column stores.
 */
export function businessToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** 'YYYY-MM' for the month containing `day`, and for the month before it. */
export function previousMonthKey(monthKeyValue: string): string {
  const [year, month] = monthKeyValue.split('-').map(Number)
  if (!year || !month) return monthKeyValue
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`
}

/**
 * The ledger as CSV, for an accountant or a tax return.
 *
 * Amounts are written as plain decimals ("1234.56"), not "$1,234.56" — a currency-
 * formatted string with a thousands separator is text to a spreadsheet, and the whole
 * point of exporting is that the numbers add up on the other side.
 */
export function toCsv(rows: readonly (ExpenseLike & {
  description: string
  vendor: string | null
  notes: string | null
})[]): string {
  const header = ['Date', 'Description', 'Vendor', 'Category', 'Amount', 'Paid by', 'Reimbursed', 'Notes']

  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

  const lines = rows.map((r) =>
    [
      r.spentOn,
      r.description,
      r.vendor ?? '',
      r.category,
      (r.amountCents / 100).toFixed(2),
      r.paidBy,
      r.reimbursedAt ? 'yes' : 'no',
      r.notes ?? '',
    ]
      .map((cell) => escape(String(cell)))
      .join(','),
  )

  return [header.join(','), ...lines].join('\n')
}
