import { describe, expect, it } from 'vitest'
import {
  CREATE_NEW_VALUE,
  compatibleCandidates,
  formatMappingInterval,
  mappingChoice,
  mappingRequiresChoice,
  mappingSelectValue,
  paginateMappingItems,
  shouldShowProductMappingPanel,
  type ProductMappingItem,
} from './productMapping'

const candidate = (
  overrides: Partial<ProductMappingItem['candidates'][number]> = {},
): ProductMappingItem['candidates'][number] => ({
  id: 'prod_polar',
  name: 'Pro',
  recurring_interval: 'month',
  recurring_interval_count: 1,
  prices: [{ amount: 1000, currency: 'usd' }],
  compatible: true,
  incompatibilities: [],
  ...overrides,
})

function item(overrides: Partial<ProductMappingItem> = {}): ProductMappingItem {
  return {
    source_id: 'prod_1:month:1',
    product_source_id: 'prod_1',
    name: 'Pro',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    prices: [{ amount: 1000, currency: 'usd' }],
    subscriber_count: 3,
    import_status: 'pending',
    mapped_product_id: null,
    create_new: false,
    suggested_product_id: null,
    name_collision: false,
    requires_choice: false,
    candidates: [candidate()],
    ...overrides,
  }
}

describe('mappingSelectValue', () => {
  it('prefers an explicit create-new choice', () => {
    expect(
      mappingSelectValue(item({ create_new: true, suggested_product_id: 'p' })),
    ).toBe(CREATE_NEW_VALUE)
  })

  it('uses a saved mapping, then a suggestion', () => {
    expect(mappingSelectValue(item({ mapped_product_id: 'saved' }))).toBe(
      'saved',
    )
    expect(mappingSelectValue(item({ suggested_product_id: 'hint' }))).toBe(
      'hint',
    )
  })

  it('defaults to create-new when import would create a Polar product', () => {
    expect(mappingSelectValue(item({ candidates: [] }))).toBe(CREATE_NEW_VALUE)
  })

  it('stays empty until the merchant chooses a colliding product', () => {
    expect(
      mappingSelectValue(item({ requires_choice: true, candidates: [] })),
    ).toBe('')
  })
})

describe('mappingChoice', () => {
  it('sends null when creating a new Polar product', () => {
    expect(mappingChoice('prod_1:month:1', CREATE_NEW_VALUE)).toEqual({
      source_id: 'prod_1:month:1',
      polar_product_id: null,
    })
  })
})

describe('mappingRequiresChoice', () => {
  it('blocks prepare only for pending rows that still need a choice', () => {
    expect(mappingRequiresChoice([item({ requires_choice: true })])).toBe(true)
    expect(
      mappingRequiresChoice([
        item({ requires_choice: true, import_status: 'imported' }),
      ]),
    ).toBe(false)
    expect(
      mappingRequiresChoice([
        item({ requires_choice: true, subscriber_count: 0 }),
      ]),
    ).toBe(false)
  })
})

describe('shouldShowProductMappingPanel', () => {
  it('hides when Polar has no products to map onto', () => {
    expect(shouldShowProductMappingPanel([item({ candidates: [] })])).toBe(
      false,
    )
  })

  it('hides Stripe products with no subscribers', () => {
    expect(shouldShowProductMappingPanel([item({ subscriber_count: 0 })])).toBe(
      false,
    )
  })

  it('shows products that still have subscribers', () => {
    expect(
      shouldShowProductMappingPanel([
        item({ suggested_product_id: 'prod_polar' }),
      ]),
    ).toBe(true)
  })
})

describe('compatibleCandidates', () => {
  it('keeps Polar products whose amount differs but are still compatible', () => {
    const mismatched = candidate({
      id: 'raised',
      compatible: true,
      incompatibilities: ['amount_mismatch'],
      prices: [{ amount: 1000, currency: 'usd' }],
    })
    expect(
      compatibleCandidates(
        item({
          candidates: [
            mismatched,
            candidate({ id: 'other', compatible: false }),
          ],
        }),
      ),
    ).toEqual([mismatched])
  })
})

describe('formatMappingInterval', () => {
  it('labels a monthly and a multi-month cadence', () => {
    expect(formatMappingInterval('month', 1)).toBe('Monthly')
    expect(formatMappingInterval('month', 3)).toBe('Every 3 months')
    expect(formatMappingInterval(null, 1)).toBe('—')
  })
})

describe('paginateMappingItems', () => {
  const items = Array.from({ length: 6 }, (_, index) =>
    item({ source_id: `prod_${index}:month:1` }),
  )

  it('hides pagination when every product fits on one page', () => {
    const paged = paginateMappingItems(items.slice(0, 5), 1)
    expect(paged.showPagination).toBe(false)
    expect(paged.items).toHaveLength(5)
  })

  it('pages five at a time and clamps out-of-range pages', () => {
    const first = paginateMappingItems(items, 1)
    expect(first.showPagination).toBe(true)
    expect(first.items).toHaveLength(5)
    expect(first.rangeEnd).toBe(5)

    const second = paginateMappingItems(items, 2)
    expect(second.items).toHaveLength(1)
    expect(second.rangeStart).toBe(6)
    expect(second.rangeEnd).toBe(6)

    expect(paginateMappingItems(items, 99).page).toBe(2)
  })
})
