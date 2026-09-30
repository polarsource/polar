import { describe, expect, it } from 'vitest'
import {
  effectiveTax,
  isTaxEditable,
  runWithConcurrency,
  taxBreakdown,
  type TaxRow,
} from './bulkTaxRecords'

const baseRow = {
  record_id: 'rec_1',
  entity: 'subscriptions' as const,
  source_id: 'sub_1',
  title: 'ada@example.com',
  status: 'importable' as const,
  import_status: 'pending' as const,
  cutover_status: null,
  tax_behavior: null,
}

function row(overrides: Partial<TaxRow>): TaxRow {
  return { ...baseRow, ...overrides } as TaxRow
}

describe('effectiveTax', () => {
  it('defaults an unset row to inclusive', () => {
    expect(effectiveTax(row({ tax_behavior: null }))).toBe('inclusive')
    expect(effectiveTax(row({ tax_behavior: 'exclusive' }))).toBe('exclusive')
  })
})

describe('isTaxEditable', () => {
  it('excludes switched, staying and unstaged rows', () => {
    expect(isTaxEditable(row({}))).toBe(true)
    expect(isTaxEditable(row({ cutover_status: 'moved' }))).toBe(false)
    expect(isTaxEditable(row({ status: 'skipped' }))).toBe(false)
    expect(isTaxEditable(row({ import_status: 'skipped' }))).toBe(false)
    expect(isTaxEditable(row({ record_id: null }))).toBe(false)
  })

  it('keeps rows the switch skipped or failed, which can still move', () => {
    expect(isTaxEditable(row({ cutover_status: 'skipped' }))).toBe(true)
    expect(isTaxEditable(row({ cutover_status: 'failed' }))).toBe(true)
  })
})

describe('taxBreakdown', () => {
  it('counts editable rows by tax and switched rows as locked', () => {
    expect(
      taxBreakdown([
        row({}),
        row({ tax_behavior: 'exclusive' }),
        row({ tax_behavior: 'exclusive', cutover_status: 'moved' }),
        row({ status: 'skipped' }),
      ]),
    ).toEqual({ inclusive: 1, exclusive: 1, locked: 1 })
  })
})

describe('runWithConcurrency', () => {
  it('processes every item without exceeding the limit', async () => {
    let active = 0
    let peak = 0
    const seen: number[] = []
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      seen.push(item)
      active--
    })
    expect(seen.toSorted()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(peak).toBe(3)
  })

  it('does nothing for an empty list', async () => {
    let calls = 0
    await runWithConcurrency([], 5, async () => {
      calls++
    })
    expect(calls).toBe(0)
  })
})
