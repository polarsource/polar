import { checksumOf, compile, signal } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { latch } from '@/scenes/latch'
import { BALANCES, credits, NOULS, stages } from './signals'

describe('signals chapter', () => {
  const signals = compile(stages.semantic).signals!
  const budget = signals.find((s) => s.slug === 'budget-low')!
  const storm = signals.find((s) => s.slug === 'retry-storm')!

  it('compiles both kinds into the deployment', () => {
    expect(budget).toEqual({
      slug: 'budget-low',
      kind: 'meter',
      meter: 'credits',
      enter_below: 100,
      exit_at_least: 150,
    })
    expect(storm).toEqual({
      slug: 'retry-storm',
      kind: 'semantic',
      meter: 'credits',
      when: 'most recent spend is retries or loops, not progress',
      over: { amount: 1, unit: 'hour' },
      enter_above: 0.7,
      exit_below: 0.4,
    })
    expect(checksumOf(stages.meter)).not.toBe(checksumOf(stages.semantic))
  })

  it('latches the documented balance sequence', () => {
    const observed = latch(budget, BALANCES)
    expect(observed.map((o) => o.status)).toEqual([
      'inactive',
      'active',
      'active',
      'active',
      'inactive',
    ])
    expect(observed.map((o) => o.transition)).toEqual([
      null,
      'entered',
      null,
      null,
      'exited',
    ])
  })

  it('latches the documented noul sequence and holds through unknown', () => {
    expect(latch(storm, NOULS).map((o) => o.status)).toEqual([
      'inactive',
      'active',
      'active',
      'inactive',
    ])
    const held = latch(budget, [95, null, 120])
    expect(held.map((o) => o.status)).toEqual(['active', 'unknown', 'active'])
    expect(held[1]!.transition).toBeNull()
  })

  it('refuses thresholds in the wrong order, like the SDK does', () => {
    expect(() =>
      signal('bad', {
        meter: credits,
        field: 'remaining',
        enter: { below: 150 },
        exit: { atLeast: 100 },
      }),
    ).toThrow(/0 < enter.below < exit.atLeast/)
    expect(() =>
      signal('bad', {
        meter: credits,
        when: 'x',
        enter: { above: 0.3 },
        exit: { below: 0.5 },
      }),
    ).toThrow(/0 < exit.below < enter.above <= 1/)
  })
})
