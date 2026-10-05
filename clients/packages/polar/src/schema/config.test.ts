import { describe, expect, expectTypeOf, it } from 'vitest'
import { count, sum } from './usage'
import { defineConfig } from './config'
import type { MeterKey } from './config'
import { SchemaError } from './error'
import { event } from './event'
import { meter } from './meter'
import { usd } from './money'

const llmCompletion = event<{ input_tokens: number }>('llm.completion')
const toolCall = event('tool.call')
const inputTokens = meter('input_tokens', {
  name: 'Input tokens',
  usage: sum(llmCompletion, 'input_tokens'),
  price: usd(0.00015),
})
const toolCalls = meter('tool_calls', {
  name: 'Tool calls',
  usage: count(toolCall),
  price: usd(0.04),
})
const schema = { llmCompletion, toolCall, inputTokens, toolCalls }

describe('defineConfig', () => {
  it('keeps the schema and collects its meters', () => {
    const config = defineConfig({ schema })

    expect(config.schema).toBe(schema)
    expect(config.meters).toEqual([inputTokens, toolCalls])
  })

  it('keeps each meter key as a literal type', () => {
    const config = defineConfig({ schema })

    expectTypeOf<MeterKey<typeof config>>().toEqualTypeOf<
      'input_tokens' | 'tool_calls'
    >()
  })

  it('collects a meter exported under two names once', () => {
    const config = defineConfig({
      schema: { inputTokens, tokens: inputTokens },
    })

    expect(config.meters).toEqual([inputTokens])
  })

  it('rejects the same meter key from two definitions', () => {
    const again = meter('input_tokens', {
      name: 'Input tokens again',
      usage: sum(llmCompletion, 'input_tokens'),
      price: usd(2),
    })

    const define = () => defineConfig({ schema: { inputTokens, again } })

    expect(define).toThrow(SchemaError)
    expect(define).toThrow('meter: input_tokens is defined twice')
  })

  it('rejects a value that is not a definition', () => {
    // @ts-expect-error the schema holds only definitions
    const define = () => defineConfig({ schema: { price: usd(1) } })

    expect(define).toThrow(SchemaError)
    expect(define).toThrow('schema: price is not a meter or an event')
  })
})
