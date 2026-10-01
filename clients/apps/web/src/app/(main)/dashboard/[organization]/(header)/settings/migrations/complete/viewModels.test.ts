import { describe, expect, it } from 'vitest'
import { buildIdMapping } from './idMapping'
import { goLiveSteps } from './layouts/goLiveSteps'
import { sources } from './mappingFixtures'
import { customerCsv } from './mappingExport'
import {
  customerRows,
  kindStateMatrix,
  switchBatches,
  switchProgress,
} from './viewModels'

const mapping = buildIdMapping(sources())

const report = {
  started: true,
  running: false,
  completed: true,
  total: 30,
  pending: 10,
  moved: 15,
  skipped: 3,
  failed: 2,
}

describe('kindStateMatrix', () => {
  it('counts every row once under its kind and state', () => {
    const matrix = kindStateMatrix(mapping)
    expect(matrix.customers.in_polar).toBe(2)
    expect(matrix.customers.not_imported).toBe(1)
    expect(matrix.subscriptions.moved).toBe(1)
    expect(matrix.subscriptions.left_on_stripe).toBe(1)
  })
})

describe('customerRows', () => {
  it('pairs each customer with the subscriptions it owns', () => {
    const rows = customerRows(mapping)
    expect(
      rows.map((row) => [row.stripeId, row.subscriptions.map((s) => s.stripeId)]),
    ).toEqual([
      ['cus_ada', ['sub_ada']],
      ['cus_bob', ['sub_bob']],
      ['cus_eve', []],
    ])
  })

  it('writes one backfill line per subscription, with both IDs for each', () => {
    const lines = customerCsv(customerRows(mapping)).trim().split('\n')
    expect(lines).toEqual([
      'email,stripe_customer_id,polar_customer_id,stripe_subscription_id,polar_subscription_id,subscription_status',
      'ada@example.com,cus_ada,pol_cus_ada,sub_ada,pol_sub_ada,moved',
      'bob@example.com,cus_bob,pol_cus_bob,sub_bob,,left_on_stripe',
      'eve@example.com,cus_eve,,,,',
    ])
  })
})

describe('switchBatches', () => {
  it('groups switched subscriptions by the day Polar created them', () => {
    const rows = mapping.subscriptions
    const [moved] = rows
    expect(
      switchBatches([
        moved,
        { ...moved, switchedAt: '2026-09-28T18:00:00Z' },
        { ...moved, switchedAt: '2026-09-27T09:00:00Z' },
        rows[1],
      ]),
    ).toEqual([
      { day: '2026-09-27', count: 1 },
      { day: '2026-09-28', count: 2 },
    ])
  })
})

describe('switchProgress', () => {
  it('splits subscriptions the switch never saw into their own segment', () => {
    const segments = switchProgress(report, [
      ...Array.from({ length: 34 }, () => mapping.subscriptions[0]),
    ])
    expect(segments.map((segment) => [segment.key, segment.count])).toEqual([
      ['moved', 15],
      ['ready', 10],
      ['left', 3],
      ['failed', 2],
      ['unprepared', 4],
    ])
  })
})

describe('goLiveSteps', () => {
  const statuses = (overrides: Partial<Parameters<typeof goLiveSteps>[0]>) =>
    goLiveSteps({
      report,
      webhookEndpoints: 0,
      checkoutLinks: 2,
      markedDone: new Set(),
      ...overrides,
    }).map((step) => [step.key, step.status])

  it('reads switch, webhook and checkout state, and leaves manual steps to the merchant', () => {
    expect(statuses({})).toEqual([
      ['switch', 'waiting'],
      ['backfill', 'todo'],
      ['polar-webhooks', 'todo'],
      ['stripe-off', 'todo'],
      ['checkout', 'done'],
    ])
  })

  it('flags what stayed on Stripe once nothing is pending', () => {
    expect(
      statuses({
        report: { ...report, pending: 0 },
        webhookEndpoints: 1,
        markedDone: new Set(['stripe-off']),
      }),
    ).toEqual([
      ['switch', 'attention'],
      ['backfill', 'todo'],
      ['polar-webhooks', 'done'],
      ['stripe-off', 'done'],
      ['checkout', 'done'],
    ])
  })
})
