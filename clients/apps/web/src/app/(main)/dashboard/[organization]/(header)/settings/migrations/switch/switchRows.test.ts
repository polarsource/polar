import { describe, expect, it } from 'vitest'
import {
  isSwitchable,
  isSwitched,
  needsAttention,
  renewsLabel,
  type SwitchRow,
} from './switchRows'

const baseRow = {
  record_id: 'rec_1',
  entity: 'subscriptions' as const,
  source_id: 'sub_1',
  title: 'ada@example.com',
  subtitle: null,
  amount: 2900,
  currency: 'usd',
  recurring_interval: 'month',
  reason: null,
  reason_code: null,
  reason_level: null,
  import_status: 'imported' as const,
  cutover_status: null,
  cutover_error: null,
  renews_at: null,
  has_payment_method: true,
  dependencies_imported: null,
}

function row(overrides: Partial<SwitchRow>): SwitchRow {
  return { ...baseRow, ...overrides } as SwitchRow
}

describe('isSwitched', () => {
  it('is true only for moved rows', () => {
    expect(isSwitched(row({ cutover_status: 'moved' }))).toBe(true)
    expect(isSwitched(row({ cutover_status: 'skipped' }))).toBe(false)
    expect(isSwitched(row({ cutover_status: null }))).toBe(false)
  })
})

describe('isSwitchable', () => {
  it('is true for an imported, not-yet-moved row with a record id', () => {
    expect(isSwitchable(row({ cutover_status: null }))).toBe(true)
  })

  it('is true for a pending row whose dependencies are imported', () => {
    expect(
      isSwitchable(
        row({
          import_status: 'pending',
          dependencies_imported: true,
        }),
      ),
    ).toBe(true)
  })

  // Retrying re-opens skipped and failed rows, so they stay selectable.
  it('stays true for skipped and failed rows', () => {
    expect(isSwitchable(row({ cutover_status: 'skipped' }))).toBe(true)
    expect(isSwitchable(row({ cutover_status: 'failed' }))).toBe(true)
  })

  it('is false once moved', () => {
    expect(isSwitchable(row({ cutover_status: 'moved' }))).toBe(false)
  })

  it('is false when dependencies are not imported or without a record id', () => {
    expect(isSwitchable(row({ import_status: 'pending' }))).toBe(false)
    expect(isSwitchable(row({ record_id: null }))).toBe(false)
  })
})

describe('needsAttention', () => {
  it('is true for skipped and failed only', () => {
    expect(needsAttention(row({ cutover_status: 'skipped' }))).toBe(true)
    expect(needsAttention(row({ cutover_status: 'failed' }))).toBe(true)
    expect(needsAttention(row({ cutover_status: 'moved' }))).toBe(false)
    expect(needsAttention(row({ cutover_status: null }))).toBe(false)
  })
})

describe('renewsLabel', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')

  it('is null without a renewal date', () => {
    expect(renewsLabel(row({ renews_at: null }), now)).toBeNull()
  })

  it('reads in days when the renewal is more than a day out', () => {
    expect(renewsLabel(row({ renews_at: '2026-01-13T00:00:00Z' }), now)).toBe(
      'in 12 days',
    )
  })

  it('reads in hours near the safety window', () => {
    expect(renewsLabel(row({ renews_at: '2026-01-01T03:00:00Z' }), now)).toBe(
      'in 3 hours',
    )
  })
})
