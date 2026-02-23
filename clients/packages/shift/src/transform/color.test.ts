import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { transformColors, TransformError } from './color.js'
import type { FlatTokenMap, ResolvedToken } from '../types.js'

function makeMap(entries: Partial<ResolvedToken>[]): FlatTokenMap {
  const map: FlatTokenMap = new Map()
  for (const entry of entries) {
    const token: ResolvedToken = {
      path: entry.path ?? 'test',
      rawPath: entry.rawPath ?? ['test'],
      value: entry.value ?? '',
      type: entry.type ?? 'color',
      aliasOf: entry.aliasOf,
      themeValues: entry.themeValues,
    }
    map.set(token.rawPath.join('.'), token)
  }
  return map
}

describe('transformColors', () => {
  it('passes through valid hex colors unchanged', () => {
    const map = makeMap([{ rawPath: ['c'], value: '#0066ff', type: 'color' }])
    expect(Effect.runSync(transformColors(map)).get('c')?.value).toBe('#0066ff')
  })

  it('passes through rgba colors', () => {
    const map = makeMap([{ rawPath: ['c'], value: 'rgba(0, 102, 255, 0.5)', type: 'color' }])
    expect(Effect.runSync(transformColors(map)).get('c')?.value).toBe('rgba(0, 102, 255, 0.5)')
  })

  it('passes through oklch colors', () => {
    const map = makeMap([{ rawPath: ['c'], value: 'oklch(55% 0.2 240)', type: 'color' }])
    expect(Effect.runSync(transformColors(map)).get('c')?.value).toBe('oklch(55% 0.2 240)')
  })

  it('passes through named colors', () => {
    const map = makeMap([{ rawPath: ['c'], value: 'blue', type: 'color' }])
    expect(Effect.runSync(transformColors(map)).get('c')?.value).toBe('blue')
  })

  it('leaves non-color tokens untouched', () => {
    const map = makeMap([{ rawPath: ['s'], value: '16px', type: 'dimension' }])
    const result = Effect.runSync(transformColors(map))
    expect(result.get('s')?.value).toBe('16px')
    expect(result.get('s')?.type).toBe('dimension')
  })

  it('fails for empty color value', () => {
    const map = makeMap([{ rawPath: ['bad'], value: '', type: 'color' }])
    const result = Effect.runSyncExit(transformColors(map))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(TransformError)
    }
  })

  it('handles mixed token types in one map', () => {
    const map = makeMap([
      { rawPath: ['col'], value: '#fff', type: 'color' },
      { rawPath: ['siz'], value: '8px', type: 'dimension' },
      { rawPath: ['fam'], value: 'Inter', type: 'fontFamily' },
    ])
    const result = Effect.runSync(transformColors(map))
    expect(result.size).toBe(3)
  })

  it('preserves aliasOf on transformed tokens', () => {
    const map = makeMap([
      { rawPath: ['btn', 'bg'], value: '#0066ff', aliasOf: 'colors.primary', type: 'color' },
    ])
    const result = Effect.runSync(transformColors(map))
    expect(result.get('btn.bg')?.aliasOf).toBe('colors.primary')
  })

  // ── Theme values ──────────────────────────────────────────────────────

  it('normalizes theme values for color tokens', () => {
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        type: 'color',
        themeValues: { dark: { value: '#1a1a2e' } },
      },
    ])
    const result = Effect.runSync(transformColors(map))
    expect(result.get('btn.bg')?.themeValues?.['dark']?.value).toBe('#1a1a2e')
  })

  it('preserves aliasOf in theme values', () => {
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        type: 'color',
        themeValues: { dark: { value: '#6b7280', aliasOf: 'colors.secondary' } },
      },
    ])
    const result = Effect.runSync(transformColors(map))
    expect(result.get('btn.bg')?.themeValues?.['dark']?.aliasOf).toBe('colors.secondary')
  })

  it('fails for empty color in theme value', () => {
    const map = makeMap([
      {
        rawPath: ['bad'],
        value: '#fff',
        type: 'color',
        themeValues: { dark: { value: '' } },
      },
    ])
    const result = Effect.runSyncExit(transformColors(map))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(TransformError)
    }
  })

  it('does not normalize theme values for non-color tokens', () => {
    const map = makeMap([
      {
        rawPath: ['s'],
        value: '16px',
        type: 'dimension',
        themeValues: { dark: { value: '8px' } },
      },
    ])
    const result = Effect.runSync(transformColors(map))
    // dimension token passes through unchanged
    expect(result.get('s')?.themeValues?.['dark']?.value).toBe('8px')
  })
})
