import { describe, expect, it } from 'vitest'
import { count, sum } from './usage'
import { SchemaError } from './error'
import { event } from './event'
import { and, eq } from './filter'
import { meter } from './meter'
import { usd } from './money'

const completion = event<{ model: string; input_tokens: number }>(
  'llm.completion',
)

describe('meter', () => {
  it('defines a meter polar can create', () => {
    expect(
      meter('input_tokens', {
        name: 'Input tokens',
        usage: sum(completion, 'input_tokens'),
        price: usd(0.00015),
      }),
    ).toEqual({
      kind: 'meter',
      key: 'input_tokens',
      name: 'Input tokens',
      unit: 'scalar',
      filter: and(eq('name', 'llm.completion')),
      aggregation: { func: 'sum', property: 'input_tokens' },
      price: { amount: '0.015', currency: 'usd' },
    })
  })

  it('keeps a custom unit label', () => {
    expect(
      meter('storage', {
        name: 'Storage',
        unit: 'custom',
        customLabel: 'gigabyte',
        customMultiplier: 1000,
        usage: sum(event('file.uploaded'), 'bytes'),
        price: usd(0.023),
      }),
    ).toMatchObject({
      unit: 'custom',
      customLabel: 'gigabyte',
      customMultiplier: 1000,
    })
  })

  it('requires a custom label for the custom unit', () => {
    const define = () =>
      // @ts-expect-error customLabel is missing
      meter('storage', {
        name: 'Storage',
        unit: 'custom',
        usage: count(completion),
        price: usd(1),
      })

    expect(define).toThrow(SchemaError)
    expect(define).toThrow(
      'meter: custom label is required when unit is custom',
    )
  })

  it('rejects an empty key', () => {
    const define = () =>
      meter('', {
        name: 'Tool calls',
        usage: count(event('tool.call')),
        price: usd(1),
      })

    expect(define).toThrow(SchemaError)
    expect(define).toThrow('meter: key is empty')
  })

  it('rejects a short name', () => {
    const define = () =>
      meter('calls', {
        name: 'AI',
        usage: count(completion),
        price: usd(1),
      })

    expect(define).toThrow(SchemaError)
    expect(define).toThrow('meter: name must be at least 3 characters')
  })

  it('rejects a custom label on a scalar unit', () => {
    const define = () =>
      // @ts-expect-error a custom label needs the custom unit
      meter('calls', {
        name: 'API calls',
        customLabel: 'request',
        usage: count(completion),
        price: usd(0.01),
      })

    expect(define).toThrow(SchemaError)
    expect(define).toThrow(
      'meter: custom label and multiplier are only allowed when unit is custom',
    )
  })
})
