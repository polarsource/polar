import { describe, expect, it } from 'vitest'
import { getMeterUnitFormat, type MeterUnit } from './meterUnit'

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

  describe('tokens', () => {
    it('returns scale of 1_000_000', () => {
      expect(getMeterUnitFormat('tokens').scale).toBe(1_000_000)
    })

    it('returns label "1M tokens"', () => {
      expect(getMeterUnitFormat('tokens').label).toBe('1M tokens')
    })

    it('scales $10/1M tokens correctly', () => {
      // $10/1M tokens → unit_amount = 0.001 cents/token
      const { scale } = getMeterUnitFormat('tokens')
      const unitAmountCents = 0.001
      expect(unitAmountCents * scale).toBe(1000) // 1000 cents = $10
    })

    it('scales $0.50/1M tokens correctly', () => {
      const { scale } = getMeterUnitFormat('tokens')
      const unitAmountCents = 0.0000005
      expect(unitAmountCents * scale).toBeCloseTo(0.5) // 0.5 cents = $0.005
    })
  })

  describe('bytes', () => {
    it('returns scale of 1_000_000_000', () => {
      expect(getMeterUnitFormat('bytes').scale).toBe(1_000_000_000)
    })

    it('returns label "GB"', () => {
      expect(getMeterUnitFormat('bytes').label).toBe('GB')
    })

    it('scales $0.023/GB correctly', () => {
      // $0.023/GB → unit_amount = 0.023/1e9 * 100 = 2.3e-9 cents/byte
      const { scale } = getMeterUnitFormat('bytes')
      const unitAmountCents = 2.3e-9
      expect(unitAmountCents * scale).toBeCloseTo(2.3) // 2.3 cents = $0.023
    })

    it('scales $0.10/GB correctly', () => {
      const { scale } = getMeterUnitFormat('bytes')
      const unitAmountCents = 1e-10
      expect(unitAmountCents * scale).toBeCloseTo(0.1)
    })
  })

  describe('all units', () => {
    const allUnits: MeterUnit[] = ['scalar', 'tokens', 'bytes']

    it.each(allUnits)('%s returns a positive scale', (unit) => {
      expect(getMeterUnitFormat(unit).scale).toBeGreaterThan(0)
    })

    it.each(allUnits)('%s returns a non-empty label', (unit) => {
      expect(getMeterUnitFormat(unit).label.length).toBeGreaterThan(0)
    })
  })
})
