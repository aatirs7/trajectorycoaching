import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  byCategory,
  byMonth,
  type ExpenseLike,
  formatCents,
  formatDay,
  monthKey,
  monthLabel,
  owedToFounders,
  parseAmountToCents,
  previousMonthKey,
  businessToday,
  toCsv,
  totalCents,
} from './expenses'

/** Terse builder — every test only cares about two or three fields. */
function expense(over: Partial<ExpenseLike> = {}): ExpenseLike {
  return {
    spentOn: '2026-07-15',
    amountCents: 1000,
    category: 'Software & Tools',
    paidBy: 'Aatir',
    reimbursedAt: null,
    ...over,
  }
}

describe('parseAmountToCents', () => {
  it('parses whole dollars, decimals, and currency formatting', () => {
    assert.equal(parseAmountToCents('75'), 7500)
    assert.equal(parseAmountToCents('75.50'), 7550)
    assert.equal(parseAmountToCents('$75.50'), 7550)
    assert.equal(parseAmountToCents('1,234.56'), 123456)
    assert.equal(parseAmountToCents('  $1,234.56  '), 123456)
  })

  it('treats a single decimal place as tenths, not hundredths', () => {
    // "75.5" is seventy-five dollars fifty, not seventy-five dollars five cents.
    assert.equal(parseAmountToCents('75.5'), 7550)
  })

  it('does not lose a cent to floating point', () => {
    // The reason this function does integer arithmetic instead of parseFloat * 100:
    // 8.87 * 100 === 886.9999999999999 in IEEE-754.
    assert.equal(parseAmountToCents('8.87'), 887)
    assert.equal(parseAmountToCents('1.005'), null) // three decimals is a typo, not 100.5c
    assert.equal(parseAmountToCents('0.29'), 29)
  })

  it('accepts a negative amount as a refund or credit', () => {
    assert.equal(parseAmountToCents('-49.99'), -4999)
    assert.equal(parseAmountToCents('-$49.99'), -4999)
  })

  it('returns null rather than 0 for junk, so nothing logs as free', () => {
    for (const bad of ['', 'abc', '$', '.', '12.', '1.2.3', '--5', '5-', '1e3']) {
      assert.equal(parseAmountToCents(bad), null, `expected null for ${JSON.stringify(bad)}`)
    }
  })
})

describe('formatCents', () => {
  it('always shows two decimal places so a column of figures aligns', () => {
    assert.equal(formatCents(7500), '$75.00')
    assert.equal(formatCents(7550), '$75.50')
    assert.equal(formatCents(123456), '$1,234.56')
    assert.equal(formatCents(0), '$0.00')
  })

  it('formats a refund as negative', () => {
    assert.equal(formatCents(-4999), '-$49.99')
  })
})

describe('month keys are string slices, never Date conversions', () => {
  it('keeps the last day of a month in that month', () => {
    // The bug this guards: new Date('2026-07-31').getMonth() is UTC-parsed and comes back
    // as June anywhere west of Greenwich. The two founders would see different totals.
    assert.equal(monthKey('2026-07-31'), '2026-07')
    assert.equal(monthKey('2026-01-01'), '2026-01')
    assert.equal(monthKey('2026-12-31'), '2026-12')
  })

  it('labels months without touching Date either', () => {
    assert.equal(monthLabel('2026-07'), 'July 2026')
    assert.equal(monthLabel('2026-01'), 'January 2026')
    assert.equal(monthLabel('2026-12'), 'December 2026')
  })

  it('formats a day without a year', () => {
    assert.equal(formatDay('2026-07-03'), 'Jul 3')
    assert.equal(formatDay('2026-12-25'), 'Dec 25')
  })

  it('steps back a month, including across a year boundary', () => {
    assert.equal(previousMonthKey('2026-07'), '2026-06')
    assert.equal(previousMonthKey('2026-10'), '2026-09')
    assert.equal(previousMonthKey('2026-01'), '2025-12')
  })

  it('produces today in the storage format', () => {
    // Pinned to the business timezone so the server and the browser agree — see the
    // comment on businessToday(). Only the shape is asserted; the value moves daily.
    assert.match(businessToday(), /^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('byMonth', () => {
  const rows = [
    expense({ spentOn: '2026-07-01', amountCents: 1000 }),
    expense({ spentOn: '2026-07-31', amountCents: 2000 }),
    expense({ spentOn: '2026-06-15', amountCents: 500 }),
    expense({ spentOn: '2026-08-02', amountCents: 300 }),
  ]

  it('totals each month and sorts newest first', () => {
    assert.deepEqual(
      byMonth(rows).map((b) => [b.key, b.totalCents, b.count]),
      [
        ['2026-08', 300, 1],
        ['2026-07', 3000, 2],
        ['2026-06', 500, 1],
      ],
    )
  })

  it('nets a refund out of its own month', () => {
    const withRefund = [...rows, expense({ spentOn: '2026-07-20', amountCents: -1000 })]
    const july = byMonth(withRefund).find((b) => b.key === '2026-07')
    assert.equal(july?.totalCents, 2000)
    assert.equal(july?.count, 3, 'the refund is still a ledger entry')
  })

  it('omits months with no spend rather than zero-filling', () => {
    const sparse = byMonth([expense({ spentOn: '2026-01-05' }), expense({ spentOn: '2026-04-05' })])
    assert.deepEqual(
      sparse.map((b) => b.key),
      ['2026-04', '2026-01'],
    )
  })

  it('sorts across a year boundary', () => {
    const spanning = byMonth([expense({ spentOn: '2025-12-31' }), expense({ spentOn: '2026-01-01' })])
    assert.deepEqual(
      spanning.map((b) => b.key),
      ['2026-01', '2025-12'],
    )
  })

  it('is empty for no expenses', () => {
    assert.deepEqual(byMonth([]), [])
  })
})

describe('byCategory', () => {
  it('totals each category, largest first', () => {
    const rows = [
      expense({ category: 'Legal & Filing', amountCents: 10000 }),
      expense({ category: 'Software & Tools', amountCents: 2000 }),
      expense({ category: 'Software & Tools', amountCents: 3000 }),
    ]
    assert.deepEqual(
      byCategory(rows).map((b) => [b.key, b.totalCents, b.count]),
      [
        ['Legal & Filing', 10000, 1],
        ['Software & Tools', 5000, 2],
      ],
    )
  })

  it('keeps a category that nets to zero after a refund', () => {
    const rows = [
      expense({ category: 'Marketing & Ads', amountCents: 5000 }),
      expense({ category: 'Marketing & Ads', amountCents: -5000 }),
    ]
    const [only] = byCategory(rows)
    assert.equal(only?.key, 'Marketing & Ads')
    assert.equal(only?.totalCents, 0, 'spent-then-refunded is information, not an empty row')
    assert.equal(only?.count, 2)
  })
})

describe('totalCents', () => {
  it('sums, with refunds reducing the total', () => {
    assert.equal(totalCents([expense({ amountCents: 5000 }), expense({ amountCents: -2000 })]), 3000)
    assert.equal(totalCents([]), 0)
  })
})

describe('owedToFounders', () => {
  it('adds up unreimbursed personal spend per founder', () => {
    const rows = [
      expense({ paidBy: 'Aatir', amountCents: 5000 }),
      expense({ paidBy: 'Aatir', amountCents: 2500 }),
      expense({ paidBy: 'Isaiah', amountCents: 9000 }),
    ]
    assert.deepEqual(owedToFounders(rows), [
      { payer: 'Isaiah', cents: 9000 },
      { payer: 'Aatir', cents: 7500 },
    ])
  })

  it('ignores anything already reimbursed', () => {
    const rows = [
      expense({ paidBy: 'Aatir', amountCents: 5000, reimbursedAt: new Date() }),
      expense({ paidBy: 'Aatir', amountCents: 2500 }),
    ]
    assert.deepEqual(owedToFounders(rows), [{ payer: 'Aatir', cents: 2500 }])
  })

  it('never owes the business back to itself', () => {
    const rows = [expense({ paidBy: 'Business', amountCents: 100000 })]
    assert.deepEqual(owedToFounders(rows), [])
  })

  it('reduces what is owed when part of it came back', () => {
    const rows = [
      expense({ paidBy: 'Aatir', amountCents: 10000 }),
      expense({ paidBy: 'Aatir', amountCents: -3000 }),
    ]
    assert.deepEqual(owedToFounders(rows), [{ payer: 'Aatir', cents: 7000 }])
  })

  it('drops a founder whose balance nets to exactly zero', () => {
    const rows = [
      expense({ paidBy: 'Isaiah', amountCents: 4000 }),
      expense({ paidBy: 'Isaiah', amountCents: -4000 }),
    ]
    assert.deepEqual(owedToFounders(rows), [])
  })
})

describe('toCsv', () => {
  const row = {
    ...expense({ spentOn: '2026-07-15', amountCents: 123456, category: 'Legal & Filing' }),
    description: 'SCC filing fee',
    vendor: 'Virginia SCC',
    notes: null,
  }

  it('writes amounts as plain decimals a spreadsheet can add up', () => {
    const line = toCsv([row]).split('\n')[1]!
    assert.ok(line.includes('1234.56'), line)
    assert.ok(!line.includes('$'), 'a currency symbol would make it text')
    assert.ok(!line.includes('1,234'), 'a thousands separator would break the column')
  })

  it('quotes fields containing commas, quotes, or newlines', () => {
    const tricky = toCsv([{ ...row, description: 'Legal, filing', notes: 'He said "ok"' }])
    const line = tricky.split('\n')[1]!
    assert.ok(line.includes('"Legal, filing"'))
    assert.ok(line.includes('"He said ""ok"""'))
  })

  it('emits a header even with no rows', () => {
    const csv = toCsv([])
    assert.equal(csv.split('\n').length, 1)
    assert.ok(csv.startsWith('Date,Description'))
  })

  it('renders reimbursement as yes/no', () => {
    assert.ok(toCsv([row]).includes(',no,'))
    assert.ok(toCsv([{ ...row, reimbursedAt: new Date() }]).includes(',yes,'))
  })
})
