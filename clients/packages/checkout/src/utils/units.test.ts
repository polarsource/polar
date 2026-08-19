import { describe, expect, it } from 'vitest'
import { getUnitLabels } from './units'

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
