import { bill, cumulative, replay } from '@/scenes/scenario'
import { compile } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { customers, hashes, levers, scenariosLesson, stages } from './scenarios'

const GB = 1_000_000_000

describe('scenarios chapter', () => {
  it('resolves to a distinct version with only the patched fields changed', () => {
    expect(hashes.scenario).toMatch(/^[0-9a-f]{64}$/)
    expect(hashes.scenario).not.toBe(hashes.base)
    expect(hashes.v1).not.toBe(hashes.base)

    const base = compile(stages.base)
    const scenario = compile(stages.scenario)
    expect(scenario.reducers).toEqual(base.reducers)
    expect(scenario.events).toEqual(base.events)
    expect(scenario.meters.map((m) => m.slug)).toEqual(['bandwidth'])
    expect(scenario.products.map((p) => p.slug)).toEqual(['pro'])
  })

  it('reads the levers the dashboard shows off the compiled configs', () => {
    expect(levers.base).toEqual({
      fee: 49,
      included: 50 * GB,
      unitAmount: 0.00000000008,
    })
    expect(levers.scenario).toEqual({
      fee: 29,
      included: 20 * GB,
      unitAmount: 0.00000000012,
    })
  })

  it('bills fee plus overage and replays every customer under both', () => {
    expect(bill(levers.base, 12 * GB)).toBe(49)
    expect(bill(levers.base, 140 * GB)).toBe(56.2)
    expect(bill(levers.scenario, 140 * GB)).toBe(43.4)

    const result = replay(levers.base, levers.scenario, customers)
    expect(result.rows.map((row) => row.delta)).toEqual([
      -20, -17.84, -12.8, 17.6, 77.6,
    ])
    expect(result.base).toBe(508.2)
    expect(result.scenario).toBe(552.76)
  })

  it('accumulates to the replay total with the fee charged up front', () => {
    const base = cumulative(levers.base, customers)
    const scenario = cumulative(levers.scenario, customers)
    expect(base).toHaveLength(30)
    expect(base[0]).toBeGreaterThanOrEqual(5 * 49)
    expect(scenario[0]).toBeGreaterThanOrEqual(5 * 29)
    expect(base[0]).toBeGreaterThan(scenario[0]!)
    expect(base.at(-1)).toBe(508.2)
    expect(scenario.at(-1)).toBe(552.76)
  })

  it('shows the real hashes in the patch, the code and the terminal', () => {
    const shown = scenariosLesson.steps
      .map((step) => step.code ?? '')
      .join('\n')
    expect(shown).toContain(hashes.base)
    expect(shown).toContain(hashes.scenario)
  })
})
