import { describe, expect, it } from 'vitest'
import { SchemaError } from './error'
import { event, on } from './event'
import { and, eq, or } from './filter'
import { avg, count, max, min, sum, unique } from './usage'

const completion = event<{
  model: string
  input_tokens: number
  latency?: number
}>('llm.completion')
const matchesCompletion = and(eq('name', 'llm.completion'))

describe('usage', () => {
  it('counts the events of an event', () => {
    expect(count(completion)).toEqual({
      filter: matchesCompletion,
      aggregation: { func: 'count' },
    })
  })

  it('names each property aggregation', () => {
    expect(
      [
        sum(completion, 'input_tokens'),
        max(completion, 'latency'),
        min(completion, 'latency'),
        avg(completion, 'latency'),
        unique(completion, 'model'),
      ].map(({ aggregation }) => aggregation),
    ).toEqual([
      { func: 'sum', property: 'input_tokens' },
      { func: 'max', property: 'latency' },
      { func: 'min', property: 'latency' },
      { func: 'avg', property: 'latency' },
      { func: 'unique', property: 'model' },
    ])
  })

  it('keeps the filter of a matched event', () => {
    const opus = on(completion, { model: 'claude-opus-5-5' })

    expect(sum(opus, 'input_tokens').filter).toBe(opus)
  })

  it('wraps a raw clause in a conjunction', () => {
    expect(count(eq('name', 'tool.call')).filter).toEqual(
      and(eq('name', 'tool.call')),
    )
  })

  it('accepts a raw filter across events', () => {
    const calls = or(eq('name', 'tool.call'), eq('name', 'search.query'))

    expect(sum(calls, 'duration').filter).toBe(calls)
  })

  it('aggregates only declared metadata of a typed event', () => {
    // @ts-expect-error model is a string
    const sumsString = () => sum(completion, 'model')
    // @ts-expect-error missing is not declared
    const undeclared = () => unique(completion, 'missing')

    expect(sumsString).not.toThrow()
    expect(undeclared).not.toThrow()
  })

  it('rejects an empty property', () => {
    const define = () => sum(event('tool.call'), '')

    expect(define).toThrow(SchemaError)
    expect(define).toThrow('usage: property is empty')
  })
})
