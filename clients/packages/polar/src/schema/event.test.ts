import { describe, expect, it } from 'vitest'
import { SchemaError } from './error'
import { event, on, oneOf } from './event'
import { and, eq, gte, like, lt, or } from './filter'

const completion = event<{
  model: string
  input_tokens: number
  cached?: boolean
}>('llm.completion')

describe('event', () => {
  it('holds only the event name', () => {
    expect(completion).toEqual({ kind: 'event', name: 'llm.completion' })
  })

  it('rejects an empty name', () => {
    const define = () => event('')

    expect(define).toThrow(SchemaError)
    expect(define).toThrow('event: name is empty')
  })
})

describe('on', () => {
  it('matches the event name', () => {
    expect(on(completion)).toEqual(and(eq('name', 'llm.completion')))
  })

  it('compiles each matcher to clauses', () => {
    expect(
      on(completion, {
        model: oneOf('claude-opus-5-5', 'claude-fable-5-1'),
        input_tokens: [gte(100), lt(1000)],
        cached: false,
      }),
    ).toEqual(
      and(
        eq('name', 'llm.completion'),
        or(eq('model', 'claude-opus-5-5'), eq('model', 'claude-fable-5-1')),
        { property: 'input_tokens', operator: 'gte', value: 100 },
        { property: 'input_tokens', operator: 'lt', value: 1000 },
        eq('cached', false),
      ),
    )
  })

  it('takes a single comparison', () => {
    expect(on(completion, { model: like('claude%') }).clauses).toContainEqual({
      property: 'model',
      operator: 'like',
      value: 'claude%',
    })
  })

  it('checks matchers against the event metadata', () => {
    // @ts-expect-error input_tokens is a number
    const wrongType = () => on(completion, { input_tokens: like('many') })
    // @ts-expect-error missing is not declared
    const undeclared = () => on(completion, { missing: 1 })

    expect(wrongType).not.toThrow()
    expect(undeclared).not.toThrow()
  })

  it('accepts any metadata key on an untyped event', () => {
    expect(on(event('tool.call'), { tool: 'search' }).clauses).toContainEqual(
      eq('tool', 'search'),
    )
  })

  it('binds a comparison to its metadata key', () => {
    expect(
      on(event('tool.call'), { tool: eq('source', 'user') }).clauses,
    ).toContainEqual(eq('tool', 'user'))
    expect(
      on(event('tool.call'), { tool: [eq('source', 'user')] }).clauses,
    ).toContainEqual(eq('tool', 'user'))
  })

  it('rejects matching an event field as metadata', () => {
    const define = () => on(event('tool.call'), { source: 'user' })

    expect(define).toThrow(SchemaError)
    expect(define).toThrow(
      'on: source is an event field, so it cannot be matched as metadata',
    )
  })
})

describe('oneOf', () => {
  it('rejects an empty set', () => {
    const define = () => oneOf()

    expect(define).toThrow(SchemaError)
    expect(define).toThrow('oneOf: no values given')
  })
})
