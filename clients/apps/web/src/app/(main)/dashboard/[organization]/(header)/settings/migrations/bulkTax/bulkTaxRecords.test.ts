import { describe, expect, it } from 'vitest'
import {
  effectiveTax,
  isTaxEditable,
  needsTaxUpdate,
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

const undecided = { reason_code: 'subscription_tax_behavior_unspecified' }

describe('needsTaxUpdate', () => {
  it('skips rows already on the target', () => {
    expect(
      needsTaxUpdate(row({ tax_behavior: 'inclusive' }), 'inclusive'),
    ).toBe(false)
    expect(
      needsTaxUpdate(row({ tax_behavior: 'inclusive' }), 'exclusive'),
    ).toBe(true)
  })

  it('saves an undecided row even when it already reads as the target', () => {
    expect(
      needsTaxUpdate(
        row({ tax_behavior: 'inclusive', ...undecided }),
        'inclusive',
      ),
    ).toBe(true)
  })
})

describe('taxBreakdown', () => {
  it('counts editable rows by tax and leaves switched rows out', () => {
    expect(
      taxBreakdown([
        row({}),
        row({ tax_behavior: 'inclusive', ...undecided }),
        row({ tax_behavior: 'exclusive' }),
        row({ tax_behavior: 'exclusive', cutover_status: 'moved' }),
        row({ status: 'skipped' }),
      ]),
    ).toEqual({ inclusive: 1, exclusive: 1, undecided: 1 })
  })
})
