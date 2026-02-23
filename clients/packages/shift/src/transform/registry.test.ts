import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { Registry, TransformError } from './registry.js'
import type { FlatTokenMap, ResolvedToken } from '../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMap(tokens: Partial<ResolvedToken>[]): FlatTokenMap {
  const map: FlatTokenMap = new Map()
  for (const t of tokens) {
    const token: ResolvedToken = {
      path: t.path ?? 'test',
      rawPath: t.rawPath ?? ['test'],
      value: t.value ?? '#000',
      type: t.type ?? 'color',
      aliasOf: t.aliasOf,
      themeValues: t.themeValues,
    }
    map.set(token.rawPath.join('.'), token)
  }
  return map
}

// ── Registry ──────────────────────────────────────────────────────────────────

describe('Registry', () => {
  it('applies a matching value transform', () => {
    const registry = new Registry()
    registry.register('test/upper', {
      match: (t) => t.type === 'color',
      transform: (v) => Effect.succeed(String(v).toUpperCase()),
    })
    registry.define('pipe', ['test/upper'])

    const map = makeMap([{ rawPath: ['c'], value: '#abc', type: 'color' }])
    const result = Effect.runSync(registry.apply('pipe', map))
    expect(result.get('c')?.value).toBe('#ABC')
  })

  it('skips non-matching tokens', () => {
    const registry = new Registry()
    registry.register('color/x', {
      match: (t) => t.type === 'color',
      transform: (v) => Effect.succeed('CONVERTED'),
    })
    registry.define('pipe', ['color/x'])

    const map = makeMap([{ rawPath: ['s'], value: '16px', type: 'dimension' }])
    const result = Effect.runSync(registry.apply('pipe', map))
    expect(result.get('s')?.value).toBe('16px')
  })

  it('applies transforms in sequence', () => {
    const registry = new Registry()
    registry.register('step1', {
      match: () => true,
      transform: (v) => Effect.succeed(`${v}-A`),
    })
    registry.register('step2', {
      match: () => true,
      transform: (v) => Effect.succeed(`${v}-B`),
    })
    registry.define('pipe', ['step1', 'step2'])

    const map = makeMap([{ rawPath: ['x'], value: 'start', type: 'string' }])
    const result = Effect.runSync(registry.apply('pipe', map))
    expect(result.get('x')?.value).toBe('start-A-B')
  })

  it('applies transforms to themeValues', () => {
    const registry = new Registry()
    registry.register('color/x', {
      match: (t) => t.type === 'color',
      transform: (v) => Effect.succeed(`converted:${v}`),
    })
    registry.define('pipe', ['color/x'])

    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#fff',
        type: 'color',
        themeValues: { dark: { value: '#000' } },
      },
    ])
    const result = Effect.runSync(registry.apply('pipe', map))
    const token = result.get('btn.bg')!
    expect(String(token.value)).toBe('converted:#fff')
    expect(String(token.themeValues?.['dark']?.value)).toBe('converted:#000')
  })

  it('preserves aliasOf in themeValues', () => {
    const registry = new Registry()
    registry.register('color/x', {
      match: (t) => t.type === 'color',
      transform: (v) => Effect.succeed(`x:${v}`),
    })
    registry.define('pipe', ['color/x'])

    const map = makeMap([
      {
        rawPath: ['c'],
        value: '#fff',
        type: 'color',
        themeValues: { dark: { value: '#000', aliasOf: 'colors.black' } },
      },
    ])
    const result = Effect.runSync(registry.apply('pipe', map))
    expect(result.get('c')?.themeValues?.['dark']?.aliasOf).toBe('colors.black')
  })

  it('fails with TransformError for unknown pipeline', () => {
    const registry = new Registry()
    const err = Effect.runSyncExit(registry.apply('nonexistent', new Map()))
    expect(err._tag).toBe('Failure')
    if (err._tag === 'Failure') {
      const failure = err.cause
      expect(failure._tag).toBe('Fail')
      if (failure._tag === 'Fail') {
        expect(failure.error).toBeInstanceOf(TransformError)
        expect((failure.error as TransformError).cause).toContain('"nonexistent"')
      }
    }
  })

  it('fails with TransformError for unknown value transform in pipeline', () => {
    const registry = new Registry()
    registry.define('pipe', ['not/registered'])
    const err = Effect.runSyncExit(registry.apply('pipe', new Map()))
    expect(err._tag).toBe('Failure')
  })

  it('fails when a value transform fails', () => {
    const registry = new Registry()
    registry.register('bad', {
      match: () => true,
      transform: (_, token) =>
        Effect.fail(new TransformError({ name: 'bad', path: token.path, cause: 'oops' })),
    })
    registry.define('pipe', ['bad'])

    const map = makeMap([{ rawPath: ['x'], value: 'v', type: 'color' }])
    const err = Effect.runSyncExit(registry.apply('pipe', map))
    expect(err._tag).toBe('Failure')
  })

  it('handles an empty map', () => {
    const registry = new Registry()
    registry.define('pipe', [])
    const result = Effect.runSync(registry.apply('pipe', new Map()))
    expect(result.size).toBe(0)
  })

  it('pipelines() returns all defined pipeline names', () => {
    const registry = new Registry()
    registry.define('a', [])
    registry.define('b', [])
    expect(registry.pipelines()).toContain('a')
    expect(registry.pipelines()).toContain('b')
  })
})
