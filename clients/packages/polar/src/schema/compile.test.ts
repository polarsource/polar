import { describe, expect, it } from 'vitest'
import { compile } from './compile'
import { defineConfig } from './config'
import { event, on, oneOf } from './event'
import { eq, or } from './filter'
import { meter } from './meter'
import { usd } from './money'
import { count, sum } from './usage'

const llmCompletion = event<{ model: string; output_tokens: number }>(
  'llm.completion',
)
const toolCall = event('tool.call')
const premiumOutputTokens = meter('premium_output_tokens', {
  name: 'Premium output tokens',
  unit: 'token',
  usage: sum(
    on(llmCompletion, { model: oneOf('claude-opus-5-5', 'claude-fable-5-1') }),
    'output_tokens',
  ),
  price: usd(0.0006),
})
const searchRequests = meter('search_requests', {
  name: 'Search requests',
  unit: 'custom',
  customLabel: 'request',
  customMultiplier: 1000,
  usage: count(event('search.query')),
  price: usd(0.0005),
})
const toolCalls = meter('tool_calls', {
  name: 'Tool calls',
  usage: count(toolCall),
  price: usd(0.04),
})

describe('compile', () => {
  it('compiles the schema into events and meters', () => {
    const config = defineConfig({
      schema: { toolCalls, llmCompletion, toolCall, premiumOutputTokens },
    })

    expect(compile(config)).toEqual({
      events: [{ name: 'llm.completion' }, { name: 'tool.call' }],
      meters: [
        {
          slug: 'premium_output_tokens',
          name: 'Premium output tokens',
          filter: {
            conjunction: 'and',
            clauses: [
              { property: 'name', operator: 'eq', value: 'llm.completion' },
              {
                conjunction: 'or',
                clauses: [
                  {
                    property: 'model',
                    operator: 'eq',
                    value: 'claude-opus-5-5',
                  },
                  {
                    property: 'model',
                    operator: 'eq',
                    value: 'claude-fable-5-1',
                  },
                ],
              },
            ],
          },
          aggregation: { func: 'sum', property: 'output_tokens' },
          unit: 'token',
          unit_amount: '0.06',
          currency: 'usd',
        },
        {
          slug: 'tool_calls',
          name: 'Tool calls',
          filter: {
            conjunction: 'and',
            clauses: [{ property: 'name', operator: 'eq', value: 'tool.call' }],
          },
          aggregation: { func: 'count' },
          unit: 'scalar',
          unit_amount: '4',
          currency: 'usd',
        },
      ],
    })
  })

  it('keeps the custom unit label and multiplier', () => {
    const { meters } = compile(defineConfig({ schema: { searchRequests } }))

    expect(meters).toEqual([
      {
        slug: 'search_requests',
        name: 'Search requests',
        filter: {
          conjunction: 'and',
          clauses: [
            { property: 'name', operator: 'eq', value: 'search.query' },
          ],
        },
        aggregation: { func: 'count' },
        unit: 'custom',
        custom_label: 'request',
        custom_multiplier: 1000,
        unit_amount: '0.05',
        currency: 'usd',
      },
    ])
  })

  it('lists events a meter matches without the schema exporting them', () => {
    const either = meter('either', {
      name: 'Either event',
      usage: count(or(eq('name', 'b.event'), eq('name', 'a.event'))),
      price: usd(1),
    })

    const { events } = compile(
      defineConfig({ schema: { searchRequests, either } }),
    )

    expect(events).toEqual([
      { name: 'a.event' },
      { name: 'b.event' },
      { name: 'search.query' },
    ])
  })

  it('lists an event the schema exports but no meter uses', () => {
    const { events, meters } = compile(defineConfig({ schema: { toolCall } }))

    expect(events).toEqual([{ name: 'tool.call' }])
    expect(meters).toEqual([])
  })

  it('compiles the same schema in any order to the same JSON', () => {
    const forward = compile(
      defineConfig({ schema: { toolCalls, searchRequests, toolCall } }),
    )
    const backward = compile(
      defineConfig({ schema: { toolCall, searchRequests, toolCalls } }),
    )

    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward))
  })

  it('produces plain JSON', () => {
    const ir = compile(
      defineConfig({
        schema: { llmCompletion, premiumOutputTokens, searchRequests },
      }),
    )

    expect(JSON.parse(JSON.stringify(ir))).toEqual(ir)
  })
})
