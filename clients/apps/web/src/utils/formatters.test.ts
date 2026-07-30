import { describe, expect, it } from 'vitest'
import { formatHumanFriendlyScalar } from './formatters'

describe('formatHumanFriendlyScalar', () => {
  it('uses the statistics abbreviation thresholds and precision', () => {
    expect(formatHumanFriendlyScalar(0.01)).toEqual('0.01')
    expect(formatHumanFriendlyScalar(12)).toEqual('12')
    expect(formatHumanFriendlyScalar(12.3)).toEqual('12.30')
    expect(formatHumanFriendlyScalar(1_234)).toEqual('1,234')
    expect(formatHumanFriendlyScalar(1_234.56)).toEqual('1,234.56')
    expect(formatHumanFriendlyScalar(12_345.67)).toEqual('12,345')
    expect(formatHumanFriendlyScalar(123_456.78)).toEqual('123,456')
    expect(formatHumanFriendlyScalar(1_234_567)).toEqual('1.235M')
    expect(formatHumanFriendlyScalar(12_345_678)).toEqual('12.346M')
    expect(formatHumanFriendlyScalar(123_456_789)).toEqual('123.46M')
  })

  it('applies the same rules to negative values', () => {
    expect(formatHumanFriendlyScalar(-12_345.67)).toEqual('-12,345')
    expect(formatHumanFriendlyScalar(-1_234_567)).toEqual('-1.235M')
    expect(formatHumanFriendlyScalar(-123_456_789)).toEqual('-123.46M')
  })
})
