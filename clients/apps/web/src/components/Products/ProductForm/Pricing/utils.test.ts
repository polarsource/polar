import { describe, expect, it } from 'vitest'
import { shouldShowMeterCycle } from './utils'

const base = {
  isRecurring: true,
  hasMeteredPrice: false,
  hasMeterCreditBenefit: false,
  hasSavedMeterCycle: false,
}

describe('shouldShowMeterCycle', () => {
  it('stays hidden on a recurring product with nothing metered', () => {
    expect(shouldShowMeterCycle(base)).toBe(false)
  })

  it('shows once a metered price is added', () => {
    expect(shouldShowMeterCycle({ ...base, hasMeteredPrice: true })).toBe(true)
  })

  it('shows for a meter-credit benefit without any metered price', () => {
    expect(shouldShowMeterCycle({ ...base, hasMeterCreditBenefit: true })).toBe(
      true,
    )
  })

  it('shows a saved meter cycle even once its trigger is gone', () => {
    expect(shouldShowMeterCycle({ ...base, hasSavedMeterCycle: true })).toBe(
      true,
    )
  })

  it('stays hidden on a one-time product', () => {
    expect(
      shouldShowMeterCycle({
        isRecurring: false,
        hasMeteredPrice: true,
        hasMeterCreditBenefit: true,
        hasSavedMeterCycle: true,
      }),
    ).toBe(false)
  })
})
