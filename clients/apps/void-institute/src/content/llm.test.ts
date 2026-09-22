import { compile } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { creditsFor, estimateInputTokens, ladder } from '@/scenes/llm'
import { call, RATES, stages, tiers } from './llm'

describe('llm chapter', () => {
  it('compiles the plugin into an event, reducers and a credits meter', () => {
    const ir = compile(stages.plugin)
    expect(ir.events.map((e) => e.name)).toEqual([
      'assistant.completion',
      'assistant.granted',
    ])
    const meters = ir.meters.map((m) => m.slug)
    expect(meters).toContain('assistant-credits')
    expect(ir.reducers.map((r) => r.slug)).toEqual(
      expect.arrayContaining([
        'assistant-input-anthropic-claude-sonnet-5',
        'assistant-output-anthropic-claude-haiku-4-5',
        'assistant-input-other',
      ]),
    )
    expect(ir.activities).toBeUndefined()
  })

  it('puts the credits meter on the product and the activity in the deployment', () => {
    expect(compile(stages.product).products[0]!.meters).toEqual([
      {
        slug: 'assistant-credits',
        included: 100_000,
        limit: 'hard',
        rollover_cap: 0,
      },
    ])
    expect(compile(stages.classified).activities).toEqual([
      { slug: 'assistant', event: 'assistant.completion', group_by: 'call_id' },
    ])
  })

  it('estimates and converts credits the way the plugin does', () => {
    expect(estimateInputTokens(1_840)).toBe(460)
    expect(
      creditsFor(RATES['anthropic/claude-sonnet-5'], {
        input: 460,
        output: 4096,
      }),
    ).toBe(63)
    expect(
      creditsFor(RATES['anthropic/claude-sonnet-5'], {
        input: 460,
        output: 812,
      }),
    ).toBe(14)
    expect(creditsFor(RATES.other, { input: 10_000, output: 10_000 })).toBe(5)
    expect(call.estimate.credits).toBe(63)
    expect(call.credits).toBe(14)
  })

  it('falls back to the tier with room', () => {
    expect(
      tiers.map((t) => [t.model.split('/')[1], t.estimate, t.allowed, t.ran]),
    ).toEqual([
      ['claude-sonnet-5', 63, false, false],
      ['claude-haiku-4-5', 21, true, true],
    ])
    const roomy = ladder(
      [
        {
          model: 'a',
          rate: RATES['anthropic/claude-sonnet-5'],
          minRemaining: 50,
        },
        { model: 'b', rate: RATES.other },
      ],
      { input: 460, maxOutput: 4096 },
      100,
    )
    expect(roomy.map((t) => t.ran)).toEqual([false, true])
  })
})
