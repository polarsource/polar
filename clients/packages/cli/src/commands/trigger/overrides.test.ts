import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import {
  describeRejection,
  parseOverride,
  parseOverrides,
} from '@/commands/trigger/overrides'

describe('parseOverride', () => {
  test.each([
    ['data.amount=2000', ['data.amount', '2000']],
    ['data.postal_code=90210', ['data.postal_code', '90210']],
    [
      'data.customer.email=jane@example.com',
      ['data.customer.email', 'jane@example.com'],
    ],
    ['data.metadata.plan="pro"', ['data.metadata.plan', 'pro']],
    ['data.paid=true', ['data.paid', 'true']],
    ['data.discount=null', ['data.discount', null]],
    ['data.metadata={"plan":"pro"}', ['data.metadata', { plan: 'pro' }]],
    ['data.items=[1]', ['data.items', [1]]],
    ['data.items.0.label=a=b', ['data.items.0.label', 'a=b']],
    ['data.note={not json', ['data.note', '{not json']],
  ])('parses %s', async (input, expected) => {
    expect(await Effect.runPromise(parseOverride(input))).toEqual(expected)
  })

  test.each(['no-equals', '=value'])('rejects %s', async (input) => {
    const error = await Effect.runPromise(
      parseOverride(input).pipe(Effect.flip),
    )
    expect(error._tag).toBe('TriggerError')
    expect(error.hint).toContain('path=value')
  })
})

describe('parseOverrides', () => {
  test('builds an object from the pairs', async () => {
    expect(await Effect.runPromise(parseOverrides(['a=1', 'b.c="x"']))).toEqual(
      { a: '1', 'b.c': 'x' },
    )
  })

  test('rejects a path given twice', async () => {
    const error = await Effect.runPromise(
      parseOverrides(['data.amount=1', 'data.amount=2']).pipe(Effect.flip),
    )
    expect(error.message).toContain('more than once')
  })
})

describe('describeRejection', () => {
  test('lists field errors without the body and overrides prefix', () => {
    expect(
      describeRejection([
        { loc: ['body', 'overrides', 'data', 'amount'], msg: 'not an int' },
        { loc: [], msg: 'unknown' },
      ]),
    ).toBe('data.amount: not an int\n    unknown')
  })

  test('stringifies non-list details', () => {
    expect(describeRejection('boom')).toBe('boom')
  })
})
