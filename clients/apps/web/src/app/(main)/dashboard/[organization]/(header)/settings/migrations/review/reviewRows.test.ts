import { describe, expect, it } from 'vitest'
import {
  isImported,
  isSelectable,
  needsAttention,
  renewsLabel,
  type ReviewRow,
} from './reviewRows'

const baseRow = {
  record_id: 'rec_1',
  entity: 'subscriptions' as const,
  source_id: 'sub_1',
  title: 'Subscription',
  subtitle: null,
  product_name: null,
  customer_email: null,
  customer_country: null,
  amount: null,
  currency: null,
  recurring_interval: null,
  reason: null,
  reason_code: null,
  reason_level: null,
  dependencies_imported: null,
  renews_at: null,
}

function row(overrides: Partial<ReviewRow>): ReviewRow {
  return { ...baseRow, ...overrides } as ReviewRow
}

describe('isSelectable', () => {
  it('selects an importable, pending row with a record id', () => {
    expect(
      isSelectable(row({ status: 'importable', import_status: 'pending' })),
    ).toBe(true)
  })

  it('selects an importable row whose import_status is null (not yet staged)', () => {
    expect(
      isSelectable(row({ status: 'importable', import_status: null })),
    ).toBe(true)
  })

  it('does not select a row without a record id (price rows)', () => {
    expect(
      isSelectable(
        row({
          record_id: null,
          status: 'importable',
          import_status: 'pending',
        }),
      ),
    ).toBe(false)
  })

  it('does not select a precheck-skipped row', () => {
    expect(
      isSelectable(row({ status: 'skipped', import_status: 'pending' })),
    ).toBe(false)
  })

  it('does not select an imported row', () => {
    expect(
      isSelectable(row({ status: 'importable', import_status: 'imported' })),
    ).toBe(false)
  })

  it('does not select a subscription whose dependencies are already imported', () => {
    expect(
      isSelectable(
        row({
          status: 'importable',
          import_status: 'pending',
          dependencies_imported: true,
        }),
      ),
    ).toBe(false)
  })

  // Regression test for the reported bug: the importer ignores non-`pending`
  // records, so a row skipped at import time must not be selectable —
  // otherwise the user's selection count won't match what actually imports.
  it('does not select a row skipped at import time', () => {
    expect(
      isSelectable(row({ status: 'importable', import_status: 'skipped' })),
    ).toBe(false)
  })

  it('does not select a failed row', () => {
    expect(
      isSelectable(row({ status: 'importable', import_status: 'failed' })),
    ).toBe(false)
  })
})

describe('isImported', () => {
  it('is true when import_status is imported', () => {
    expect(isImported(row({ import_status: 'imported' }))).toBe(true)
  })

  it('is false for any other import_status', () => {
    const other: Array<ReviewRow['import_status']> = [
      'pending',
      'skipped',
      'failed',
      null,
    ]
    for (const import_status of other) {
      expect(isImported(row({ import_status }))).toBe(false)
    }
  })
})

describe('needsAttention', () => {
  it('is true for an action_required reason that is not imported', () => {
    expect(
      needsAttention(
        row({
          import_status: 'pending',
          reason_level: 'action_required',
        }),
      ),
    ).toBe(true)
  })

  it('is false when the row is imported, even with an action_required reason', () => {
    expect(
      needsAttention(
        row({
          import_status: 'imported',
          reason_level: 'action_required',
        }),
      ),
    ).toBe(false)
  })

  it('is false for an info-level reason', () => {
    expect(
      needsAttention(row({ import_status: 'pending', reason_level: 'info' })),
    ).toBe(false)
  })
})

describe('renewsLabel', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')

  it('is null without a renewal date', () => {
    expect(renewsLabel(row({ renews_at: null }), now)).toBeNull()
  })

  it('reads in days when the renewal is within 30 days', () => {
    expect(renewsLabel(row({ renews_at: '2026-01-13T00:00:00Z' }), now)).toBe(
      'in 12 days',
    )
  })

  it('reads in hours when the renewal is under a day away', () => {
    expect(renewsLabel(row({ renews_at: '2026-01-01T03:00:00Z' }), now)).toBe(
      'in 3 hours',
    )
  })

  it('reads as a calendar day when the renewal is 30+ days out', () => {
    expect(renewsLabel(row({ renews_at: '2026-03-15T00:00:00Z' }), now)).toBe(
      'on Mar 15',
    )
  })
})
