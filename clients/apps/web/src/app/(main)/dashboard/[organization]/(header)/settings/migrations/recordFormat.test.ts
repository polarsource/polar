import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  intervalLabel,
  renewalDate,
  renewsLabel,
  taxLabel,
} from './recordFormat'

type MigrationRecord = schemas['MerchantMigrationRecordItem']

function row(overrides: Partial<MigrationRecord>): MigrationRecord {
  return {
    record_id: 'rec_1',
    entity: 'subscriptions',
    source_id: 'sub_1',
    title: 'Subscription',
    subtitle: null,
    product_name: null,
    product_source_id: null,
    customer_email: null,
    customer_name: null,
    customer_source_id: null,
    customer_country: null,
    amount: null,
    currency: null,
    recurring_interval: null,
    recurring_interval_count: null,
    automatic_tax: null,
    renews_at: null,
    reason: null,
    reason_code: null,
    reason_level: null,
    dependencies_imported: null,
    ...overrides,
  } as MigrationRecord
}

describe('renewalDate', () => {
  it('is null without a renewal date', () => {
    expect(renewalDate(row({ renews_at: null }))).toBeNull()
  })

  it('is null for an unparseable date', () => {
    expect(renewalDate(row({ renews_at: 'not a date' }))).toBeNull()
  })

  it('reads as a full calendar date', () => {
    expect(renewalDate(row({ renews_at: '2026-03-15T00:00:00Z' }))).toBe(
      'Mar 15, 2026',
    )
  })
})

describe('intervalLabel', () => {
  it('is null without an interval', () => {
    expect(intervalLabel(row({ recurring_interval: null }))).toBeNull()
  })

  it('reads singular when each period spans one unit', () => {
    expect(
      intervalLabel(
        row({ recurring_interval: 'month', recurring_interval_count: 1 }),
      ),
    ).toBe('Every month')
  })

  it('reads plural when a period spans several units', () => {
    expect(
      intervalLabel(
        row({ recurring_interval: 'month', recurring_interval_count: 3 }),
      ),
    ).toBe('Every 3 months')
  })

  it('assumes a single unit when the count is missing', () => {
    expect(
      intervalLabel(
        row({ recurring_interval: 'year', recurring_interval_count: null }),
      ),
    ).toBe('Every year')
  })
})

describe('renewsLabel', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')

  it('is null without a renewal date', () => {
    expect(renewsLabel(row({ renews_at: null }), { now })).toBeNull()
  })

  it('reads in days when the renewal is within 30 days', () => {
    expect(
      renewsLabel(row({ renews_at: '2026-01-13T00:00:00Z' }), { now }),
    ).toBe('in 12 days')
  })

  it('reads in hours when the renewal is under a day away', () => {
    expect(
      renewsLabel(row({ renews_at: '2026-01-01T03:00:00Z' }), { now }),
    ).toBe('in 3 hours')
  })

  it('reads as a calendar day when the renewal is 30+ days out', () => {
    expect(
      renewsLabel(row({ renews_at: '2026-03-15T00:00:00Z' }), { now }),
    ).toBe('on Mar 15')
  })

  it('stays relative past 30 days when calendarAfterDays is null', () => {
    expect(
      renewsLabel(row({ renews_at: '2026-03-15T00:00:00Z' }), {
        now,
        calendarAfterDays: null,
      }),
    ).toBe('in 73 days')
  })
})

describe('taxLabel', () => {
  it('is null when the source does not say', () => {
    expect(taxLabel(row({ automatic_tax: null }))).toBeNull()
  })

  it('says so when the source calculated tax', () => {
    expect(taxLabel(row({ automatic_tax: true }))).toBe('Calculated by Stripe')
  })

  it('says so when the source did not', () => {
    expect(taxLabel(row({ automatic_tax: false }))).toBe(
      'Not calculated by Stripe',
    )
  })
})
