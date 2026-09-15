import { assert, it } from '@effect/vitest'
import { Effect } from 'effect'
import { describePricePreview, previewWindow } from '../src/cli/preview'
import type { MeterPricePreview } from '../src/api/generated'

const preview: MeterPricePreview = {
  unavailable: null,
  excluded_customers: [],
  window: { start: '2026-01-01', end: '2026-02-01' },
  currency: 'usd',
  current_unit_amount: '0.002',
  proposed_unit_amount: '0.003',
  billable_units: '35000',
  current_amount: '70.000',
  proposed_amount: '105.000',
  difference: '35.000',
  customers: [
    {
      external_id: 'orbit',
      name: 'Orbit',
      billable_units: '25000',
      current_amount: '50',
      proposed_amount: '75',
      difference: '25',
    },
    {
      external_id: 'acme',
      name: 'Acme',
      billable_units: '10000',
      current_amount: '20',
      proposed_amount: '30',
      difference: '10',
    },
  ],
}

it('shows per-customer charges, exact unit prices, totals and period', () => {
  const text = describePricePreview(preview)
  assert.equal(
    text,
    [
      '    $0.002 → $0.003    2026-01-01 – 2026-02-01 UTC',
      '',
      '    Customer     Units  Current  Proposed  Difference',
      '    ─────────────────────────────────────────────────',
      '    Orbit       25,000   $50.00    $75.00     +$25.00',
      '    Acme        10,000   $20.00    $30.00     +$10.00',
      '    ─────────────────────────────────────────────────',
      '    Total       35,000   $70.00   $105.00     +$35.00',
    ].join('\n'),
  )
})

it('labels partial totals and does not present unsupported changes as zero revenue', () => {
  const unavailable = describePricePreview({
    ...preview,
    unavailable: 'Currency changed',
  })
  assert.include(unavailable, 'Price preview unavailable: Currency changed')
  assert.include(
    describePricePreview({
      ...preview,
      excluded_customers: ['demo: overlapping subscriptions'],
    }),
    'Total (included customers)',
  )
  assert.include(
    describePricePreview({ ...preview, customers: [] }),
    'No eligible customer usage',
  )
  const withIdle = describePricePreview({
    ...preview,
    customers: [
      ...(preview.customers ?? []),
      {
        external_id: 'idle',
        name: 'Idle',
        billable_units: '0',
        current_amount: '0',
        proposed_amount: '0',
        difference: '0',
      },
    ],
  })
  assert.include(withIdle, '1 customer with no usage in this period')
  assert.notInclude(withIdle, 'Idle')
})

it('prints negative changes and zero proposed charges', () => {
  const text = describePricePreview({
    ...preview,
    proposed_amount: '0',
    difference: '-70',
  })
  assert.match(text, /Total\s+35,000\s+\$70.00\s+\$0.00\s+-\$70.00/)
})

it.effect('defaults to the last 30 complete UTC days', () =>
  Effect.gen(function* () {
    const window = yield* previewWindow(
      undefined,
      undefined,
      new Date('2026-09-08T12:00:00Z'),
    )
    assert.deepEqual(window, { start: '2026-08-09', end: '2026-09-08' })
  }),
)

it.effect('accepts an explicit historical period', () =>
  Effect.gen(function* () {
    assert.deepEqual(
      yield* previewWindow('2026-01-01', '2026-02-01'),
      preview.window,
    )
  }),
)

it.effect('rejects partial, reversed, invalid and future ranges', () =>
  Effect.gen(function* () {
    const now = new Date('2026-09-08T12:00:00Z')
    for (const [from, to] of [
      ['2026-01-01', undefined],
      [undefined, '2026-02-01'],
      ['2026-02-01', '2026-01-01'],
      ['2026-02-30', '2026-03-01'],
      ['2026-01-01', '2026-09-09'],
      ['2026-01-01T12:00:00Z', '2026-02-01'],
    ]) {
      const error = yield* Effect.flip(previewWindow(from, to, now))
      assert.equal(error._tag, 'PreviewError')
    }
  }),
)
