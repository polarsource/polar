import { describe, expect, it } from 'vitest'
import { getMeterUnitFormat, type MeterUnit } from '@polar-sh/ui/lib/meterUnit'

describe('getMeterUnitFormat', () => {
  describe('scalar', () => {
    it('returns scale of 1', () => {
      expect(getMeterUnitFormat('scalar').scale).toBe(1)
    })

    it('returns label "unit"', () => {
      expect(getMeterUnitFormat('scalar').label).toBe('unit')
    })

    it('does not scale the unit amount', () => {
      const { scale } = getMeterUnitFormat('scalar')
      expect(100 * scale).toBe(100)
    })
  })

  describe('token', () => {
    it('returns scale of 1_000_000', () => {
      expect(getMeterUnitFormat('token').scale).toBe(1_000_000)
    })

    it('returns label "1M tokens"', () => {
      expect(getMeterUnitFormat('token').label).toBe('1M tokens')
    })

    it('scales $10/1M tokens correctly', () => {
      // $10/1M tokens → unit_amount = 0.001 cents/token
      const { scale } = getMeterUnitFormat('token')
      const unitAmountCents = 0.001
      expect(unitAmountCents * scale).toBe(1000) // 1000 cents = $10
    })

    it('scales $0.50/1M tokens correctly', () => {
      const { scale } = getMeterUnitFormat('token')
      const unitAmountCents = 0.0000005
      expect(unitAmountCents * scale).toBeCloseTo(0.5) // 0.5 cents = $0.005
    })
  })

  describe('custom', () => {
    it('returns customMultiplier as scale', () => {
      const { scale } = getMeterUnitFormat('custom', {
        customLabel: 'request',
        customMultiplier: 1000,
      })
      expect(scale).toBe(1000)
    })

    it('returns customLabel as label', () => {
      const { label } = getMeterUnitFormat('custom', {
        customLabel: 'request',
        customMultiplier: 1000,
      })
      expect(label).toBe('request')
    })

    it('scales $5/1000 requests correctly', () => {
      // $5/1000 requests → unit_amount = 500/1000 = 0.5 cents/request
      const { scale } = getMeterUnitFormat('custom', {
        customLabel: 'request',
        customMultiplier: 1000,
      })
      const unitAmountCents = 0.5
      expect(unitAmountCents * scale).toBe(500) // 500 cents = $5
    })

    it('falls back to scale=1 and label="unit" when options are missing', () => {
      const { scale, label } = getMeterUnitFormat('custom')
      expect(scale).toBe(1)
      expect(label).toBe('unit')
    })

    it('falls back to scale=1 when customMultiplier is null', () => {
      const { scale } = getMeterUnitFormat('custom', {
        customLabel: 'request',
        customMultiplier: null,
      })
      expect(scale).toBe(1)
    })

    it('falls back to label="unit" when customLabel is null', () => {
      const { label } = getMeterUnitFormat('custom', {
        customLabel: null,
        customMultiplier: 1000,
      })
      expect(label).toBe('unit')
    })
  })

  describe('all units', () => {
    const allUnits: MeterUnit[] = ['scalar', 'token', 'custom']

    it.each(allUnits)('%s returns a positive scale', (unit) => {
      expect(getMeterUnitFormat(unit).scale).toBeGreaterThan(0)
    })

    it.each(allUnits)('%s returns a non-empty label', (unit) => {
      expect(getMeterUnitFormat(unit).label.length).toBeGreaterThan(0)
    })
  })
})
