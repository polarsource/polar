import { describe, expect, it } from 'vitest'
import { createUnitBasedPrice } from '../test-utils/makeCheckout'
import { getMinimumUnitAmount, getUnitLabels, getUnitTierRows } from './units'

describe('getUnitLabels', () => {
  it('defaults to unit / units', () => {
    expect(getUnitLabels(null)).toEqual({
      unitLabel: 'unit',
      unitLabelPlural: 'units',
    })
    expect(getUnitLabels({ unit_label: null })).toEqual({
      unitLabel: 'unit',
      unitLabelPlural: 'units',
    })
  })

  it('uses the merchant labels when set', () => {
    expect(
      getUnitLabels({
        unit_label: { en: { '=1': 'device', other: 'devices' } },
      }),
    ).toEqual({
      unitLabel: 'device',
      unitLabelPlural: 'devices',
    })
  })

  it('falls back to the plural form when the singular is unset', () => {
    expect(
      getUnitLabels({ unit_label: { en: { other: 'licenses' } } }),
    ).toEqual({
      unitLabel: 'licenses',
      unitLabelPlural: 'licenses',
    })
  })

  it('resolves the requested locale with an English fallback', () => {
    const unit_label = {
      en: { '=1': 'device', other: 'devices' },
      sv: { '=1': 'enhet', other: 'enheter' },
    }
    expect(getUnitLabels({ unit_label }, 'sv-SE')).toEqual({
      unitLabel: 'enhet',
      unitLabelPlural: 'enheter',
    })
    expect(getUnitLabels({ unit_label }, 'fr')).toEqual({
      unitLabel: 'device',
      unitLabelPlural: 'devices',
    })
  })
})

describe('getUnitTierRows', () => {
  it('uses the matching volume tier for all units', () => {
    const rows = getUnitTierRows(15, {
      type: 'volume',
      tiers: [
        { bound: 10, unit_amount: '2900' },
        { bound: null, unit_amount: '2500' },
      ],
    })

    expect(rows).toEqual([{ units: 15, pricePerUnit: 2500 }])
  })

  it('allocates units across graduated tiers', () => {
    const rows = getUnitTierRows(15, {
      type: 'graduated',
      tiers: [
        { bound: 10, unit_amount: '2900' },
        { bound: null, unit_amount: '2500' },
      ],
    })

    expect(rows).toEqual([
      { units: 10, pricePerUnit: 2900 },
      { units: 5, pricePerUnit: 2500 },
    ])
  })
})

describe('getMinimumUnitAmount', () => {
  const tiers = {
    type: 'volume' as const,
    tiers: [
      { bound: 10, unit_amount: '2900' },
      { bound: null, unit_amount: '2500' },
    ],
  }

  it('totals the minimum purchase for volume pricing', () => {
    const amount = getMinimumUnitAmount(
      createUnitBasedPrice({ minimum_units: 15, tiers }),
    )

    expect(amount).toBe(37500)
  })

  it('totals the minimum purchase for graduated pricing', () => {
    const amount = getMinimumUnitAmount(
      createUnitBasedPrice({
        minimum_units: 15,
        tiers: { ...tiers, type: 'graduated' },
      }),
    )

    expect(amount).toBe(41500)
  })
})
