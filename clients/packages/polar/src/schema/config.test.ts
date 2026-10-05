import { describe, expect, it } from 'vitest'
import { count, defineConfig, event, meter, sum, usd } from './config'

const completion = event<{ input_tokens: number }>('llm.completion')
const toolCall = event('tool.call')

describe('defineConfig', () => {
  it('collects meter definitions', () => {
    const inputTokens = meter('input_tokens', {
      reducer: sum(completion, 'input_tokens'),
      price: usd(0.00015),
    })
    const toolCalls = meter('tool_calls', {
      reducer: count(toolCall),
      price: usd(0.04),
    })

    const config = defineConfig({ schema: { inputTokens, toolCalls } })

    expect(config).toEqual({
      kind: 'config',
      schema: { inputTokens, toolCalls },
      meters: [
        {
          kind: 'meter',
          key: 'input_tokens',
          reducer: {
            kind: 'reducer',
            key: 'input_tokens',
            filter: {
              kind: 'filter',
              event: { kind: 'event', name: 'llm.completion' },
              where: {},
            },
            aggregation: { func: 'sum', property: 'input_tokens' },
          },
          price: { amount: 0.00015, currency: 'usd' },
        },
        {
          kind: 'meter',
          key: 'tool_calls',
          reducer: {
            kind: 'reducer',
            key: 'tool_calls',
            filter: {
              kind: 'filter',
              event: { kind: 'event', name: 'tool.call' },
              where: {},
            },
            aggregation: { func: 'count' },
          },
          price: { amount: 0.04, currency: 'usd' },
        },
      ],
    })
  })

  it('rejects the same meter key from two definitions', () => {
    const first = meter('input_tokens', {
      reducer: sum(completion, 'input_tokens'),
      price: usd(1),
    })
    const second = meter('input_tokens', {
      reducer: sum(completion, 'input_tokens'),
      price: usd(2),
    })

    expect(() => defineConfig({ schema: { first, second } })).toThrow(
      'meter input_tokens is defined twice',
    )
  })

  it('rejects an empty event name, an empty meter key, and a negative price', () => {
    expect(() => event('')).toThrow('event: empty name')
    expect(() =>
      meter('', {
        reducer: count(toolCall),
        price: usd(1),
      }),
    ).toThrow('meter: empty key')
    expect(() => usd(-1)).toThrow(
      'usd: amount must be a non-negative number, got -1',
    )
  })
})
