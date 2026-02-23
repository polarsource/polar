import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { transformDimensions, DimensionTransformError } from './dimension.js'
import type { FlatTokenMap, ResolvedToken } from '../types.js'

function makeMap(entries: Partial<ResolvedToken>[]): FlatTokenMap {
  const map: FlatTokenMap = new Map()
  for (const entry of entries) {
    const token: ResolvedToken = {
      path: entry.path ?? 'test',
      rawPath: entry.rawPath ?? ['test'],
      value: entry.value ?? '',
      type: entry.type ?? 'dimension',
      aliasOf: entry.aliasOf,
      themeValues: entry.themeValues,
    }
    map.set(token.rawPath.join('.'), token)
  }
  return map
}

describe('transformDimensions', () => {
  it('passes through px values', () => {
    const map = makeMap([{ rawPath: ['s'], value: '16px', type: 'dimension' }])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.value).toBe('16px')
  })

  it('passes through rem values', () => {
    const map = makeMap([{ rawPath: ['s'], value: '1rem', type: 'dimension' }])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.value).toBe('1rem')
  })

  it('passes through percentage values', () => {
    const map = makeMap([{ rawPath: ['s'], value: '50%', type: 'dimension' }])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.value).toBe('50%')
  })

  it('appends px to bare numeric string', () => {
    const map = makeMap([{ rawPath: ['s'], value: '16', type: 'dimension' }])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.value).toBe('16px')
  })

  it('appends px to numeric number value', () => {
    const map = makeMap([{ rawPath: ['s'], value: 24, type: 'dimension' }])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.value).toBe('24px')
  })

  it('leaves non-dimension tokens untouched', () => {
    const map = makeMap([{ rawPath: ['c'], value: '#fff', type: 'color' }])
    const result = Effect.runSync(transformDimensions(map))
    expect(result.get('c')?.value).toBe('#fff')
    expect(result.get('c')?.type).toBe('color')
  })

  it('fails for invalid dimension value', () => {
    const map = makeMap([{ rawPath: ['bad'], value: 'not-a-dimension', type: 'dimension' }])
    const result = Effect.runSyncExit(transformDimensions(map))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(DimensionTransformError)
    }
  })

  it('handles negative values', () => {
    const map = makeMap([{ rawPath: ['s'], value: '-8px', type: 'dimension' }])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.value).toBe('-8px')
  })

  it('handles decimal values', () => {
    const map = makeMap([{ rawPath: ['s'], value: '1.5rem', type: 'dimension' }])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.value).toBe('1.5rem')
  })

  it('preserves aliasOf on transformed tokens', () => {
    const map = makeMap([
      { rawPath: ['s'], value: '16px', aliasOf: 'spacing.md', type: 'dimension' },
    ])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.aliasOf).toBe('spacing.md')
  })

  // ── Theme values ──────────────────────────────────────────────────────

  it('normalizes theme values for dimension tokens', () => {
    const map = makeMap([
      {
        rawPath: ['s'],
        value: '16px',
        type: 'dimension',
        themeValues: { compact: { value: '12px' } },
      },
    ])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.themeValues?.['compact']?.value).toBe('12px')
  })

  it('appends px to bare numeric theme values', () => {
    const map = makeMap([
      {
        rawPath: ['s'],
        value: '16px',
        type: 'dimension',
        themeValues: { compact: { value: '12' } },
      },
    ])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.themeValues?.['compact']?.value).toBe('12px')
  })

  it('preserves aliasOf in theme values', () => {
    const map = makeMap([
      {
        rawPath: ['s'],
        value: '16px',
        type: 'dimension',
        themeValues: { compact: { value: '8px', aliasOf: 'spacing.sm' } },
      },
    ])
    expect(Effect.runSync(transformDimensions(map)).get('s')?.themeValues?.['compact']?.aliasOf).toBe('spacing.sm')
  })

  it('fails for invalid dimension in theme value', () => {
    const map = makeMap([
      {
        rawPath: ['bad'],
        value: '16px',
        type: 'dimension',
        themeValues: { compact: { value: 'not-a-size' } },
      },
    ])
    const result = Effect.runSyncExit(transformDimensions(map))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(DimensionTransformError)
    }
  })
})
