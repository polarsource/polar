import { compile } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { evaluate, fold } from '@/scenes/fold'
import { reducersLesson, stages, stream } from './reducers'

describe('reducers chapter', () => {
  const reducers = compile(stages.derive).reducers

  it('folds the stream the way the prose says', () => {
    const values = new Map(fold(reducers, stream).map((f) => [f.slug, f.value]))
    expect(values.get('bytes')).toBe(
      48_211 + 120_500 + 3_020 + 88_000 + 250_000 + 12_400,
    )
    expect(values.get('total')).toBe(6)
    expect(values.get('indexed')).toBe(4)
    expect(values.get('large')).toBe(2)
    expect(values.get('kb')).toBeCloseTo(
      (48_211 + 120_500 + 88_000 + 12_400) / 1024,
      5,
    )
    expect(values.get('success-rate')).toBeCloseTo((4 / 6) * 100, 5)
  })

  it('collects derive inputs without listing them twice', () => {
    expect(reducers.map((r) => r.slug).sort()).toEqual([
      'bytes',
      'indexed',
      'kb',
      'large',
      'success-rate',
      'total',
    ])
  })

  it('evaluates map arithmetic like the server does', () => {
    expect(evaluate('$asdf * 2', { asdf: 10 })).toBe(20)
    expect(evaluate('$asdf * 2', { asdf: '20' })).toBeNull()
    expect(evaluate('$a / $b', { a: 1, b: 0 })).toBeNull()
    expect(evaluate('($a + 20) * -1', { a: 10 })).toBe(-30)
  })

  it('ends on the compiled JSON of what it wrote', () => {
    const last = reducersLesson.steps.at(-1)!
    expect(last.lang).toBe('json')
    const parsed = JSON.parse(last.code!) as { slug: string }[]
    expect(parsed.map((r) => r.slug)).toEqual(['indexed', 'kb', 'success-rate'])
  })
})
