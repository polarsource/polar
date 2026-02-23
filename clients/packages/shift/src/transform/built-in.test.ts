import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { defaultRegistry, createDefaultRegistry } from './built-in.js'
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

function applySync(pipeline: string, tokens: Partial<ResolvedToken>[]) {
  return Effect.runSync(defaultRegistry.apply(pipeline, makeMap(tokens)))
}

// ── default pipeline ──────────────────────────────────────────────────────────

describe('default pipeline', () => {
  it('leaves colors unchanged', () => {
    const result = applySync('default', [{ rawPath: ['c'], value: '#ff0000', type: 'color' }])
    expect(result.get('c')?.value).toBe('#ff0000')
  })

  it('adds px to bare number dimension', () => {
    const result = applySync('default', [{ rawPath: ['s'], value: 16, type: 'dimension' }])
    expect(result.get('s')?.value).toBe('16px')
  })

  it('adds px to bare numeric string dimension', () => {
    const result = applySync('default', [{ rawPath: ['s'], value: '8', type: 'dimension' }])
    expect(result.get('s')?.value).toBe('8px')
  })

  it('passes through dimensions with units', () => {
    const result = applySync('default', [{ rawPath: ['s'], value: '1rem', type: 'dimension' }])
    expect(result.get('s')?.value).toBe('1rem')
  })
})

// ── color/rgb pipeline ────────────────────────────────────────────────────────

describe('color/rgb value transform', () => {
  it('converts hex to rgb()', () => {
    const result = applySync('web/rgb', [{ rawPath: ['c'], value: '#ff0000', type: 'color' }])
    expect(result.get('c')?.value).toBe('rgb(255, 0, 0)')
  })

  it('converts hsl() to rgb()', () => {
    const result = applySync('web/rgb', [
      { rawPath: ['c'], value: 'hsl(0, 100%, 50%)', type: 'color' },
    ])
    expect(String(result.get('c')?.value)).toMatch(/^rgb\(/)
  })

  it('passes through named colors unchanged', () => {
    const result = applySync('web/rgb', [{ rawPath: ['c'], value: 'blue', type: 'color' }])
    expect(result.get('c')?.value).toBe('blue')
  })

  it('passes through var() unchanged', () => {
    const result = applySync('web/rgb', [
      { rawPath: ['c'], value: 'var(--color-primary)', type: 'color' },
    ])
    expect(result.get('c')?.value).toBe('var(--color-primary)')
  })

  it('also normalizes dimensions', () => {
    const result = applySync('web/rgb', [{ rawPath: ['s'], value: 8, type: 'dimension' }])
    expect(result.get('s')?.value).toBe('8px')
  })
})

// ── color/hex pipeline ────────────────────────────────────────────────────────

describe('web pipeline (color/hex)', () => {
  it('converts rgb() to hex', () => {
    const result = applySync('web', [
      { rawPath: ['c'], value: 'rgb(255, 0, 0)', type: 'color' },
    ])
    expect(result.get('c')?.value).toBe('#ff0000')
  })

  it('normalizes hex shorthand to full hex', () => {
    const result = applySync('web', [{ rawPath: ['c'], value: '#f00', type: 'color' }])
    expect(result.get('c')?.value).toBe('#ff0000')
  })

  it('converts hsl() to hex', () => {
    const result = applySync('web', [
      { rawPath: ['c'], value: 'hsl(0, 100%, 50%)', type: 'color' },
    ])
    expect(String(result.get('c')?.value)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('passes through oklch() values unchanged', () => {
    const val = 'oklch(0.628 0.258 29.23)'
    const result = applySync('web', [{ rawPath: ['c'], value: val, type: 'color' }])
    expect(result.get('c')?.value).toBe(val)
  })

  it('converts themeValues to hex', () => {
    const result = applySync('web', [
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        type: 'color',
        themeValues: { dark: { value: 'rgb(0, 0, 0)' } },
      },
    ])
    expect(String(result.get('btn.bg')?.themeValues?.['dark']?.value)).toBe('#000000')
  })
})

// ── color/hex8rgba (via custom pipeline) ─────────────────────────────────────

describe('color/hex8rgba value transform', () => {
  it('produces 9-character #rrggbbaa string', () => {
    const reg = createDefaultRegistry()
    // Add a dedicated test pipeline using the registered color/hex8rgba transform
    reg.define('web/rgba8', ['color/hex8rgba', 'dimension/px'])
    const result = Effect.runSync(
      reg.apply('web/rgba8', makeMap([{ rawPath: ['c'], value: '#ff0000', type: 'color' }])),
    )
    expect(String(result.get('c')?.value)).toBe('#ff0000ff')
    expect(String(result.get('c')?.value)).toHaveLength(9)
  })
})

// ── web/oklch pipeline ────────────────────────────────────────────────────────

describe('web/oklch pipeline', () => {
  it('converts hex to oklch()', () => {
    const result = applySync('web/oklch', [{ rawPath: ['c'], value: '#ff0000', type: 'color' }])
    expect(String(result.get('c')?.value)).toMatch(/^oklch\(/)
    expect(String(result.get('c')?.value)).toContain('0.628')
  })

  it('converts rgb() to oklch()', () => {
    const result = applySync('web/oklch', [
      { rawPath: ['c'], value: 'rgb(255, 0, 0)', type: 'color' },
    ])
    expect(String(result.get('c')?.value)).toMatch(/^oklch\(/)
  })

  it('passes through already-oklch values', () => {
    const val = 'oklch(0.628 0.258 29.23)'
    const result = applySync('web/oklch', [{ rawPath: ['c'], value: val, type: 'color' }])
    expect(result.get('c')?.value).toBe(val)
  })

  it('passes through named colors', () => {
    const result = applySync('web/oklch', [{ rawPath: ['c'], value: 'blue', type: 'color' }])
    expect(result.get('c')?.value).toBe('blue')
  })

  it('normalizes dimensions', () => {
    const result = applySync('web/oklch', [{ rawPath: ['s'], value: 4, type: 'dimension' }])
    expect(result.get('s')?.value).toBe('4px')
  })
})

// ── ios / android pipelines (hex8argb) ────────────────────────────────────────

describe('ios / android pipelines (color/hex8argb)', () => {
  it('ios pipeline: produces #aarrggbb for opaque red', () => {
    const result = applySync('ios', [{ rawPath: ['c'], value: '#ff0000', type: 'color' }])
    expect(result.get('c')?.value).toBe('#ffff0000')
  })

  it('android pipeline: same result as ios', () => {
    const ios = applySync('ios', [{ rawPath: ['c'], value: '#0000ff', type: 'color' }])
    const android = applySync('android', [{ rawPath: ['c'], value: '#0000ff', type: 'color' }])
    expect(ios.get('c')?.value).toBe(android.get('c')?.value)
  })

  it('alpha is in the leading byte', () => {
    const result = applySync('ios', [{ rawPath: ['c'], value: '#ff0000', type: 'color' }])
    const val = String(result.get('c')?.value)
    // #ffrrggbb — first byte ff = alpha 255
    expect(val.slice(1, 3)).toBe('ff')
  })
})

// ── mixed token map ───────────────────────────────────────────────────────────

describe('mixed token map', () => {
  it('web pipeline handles colors and dimensions correctly', () => {
    const result = applySync('web', [
      { rawPath: ['c'], value: '#ff0000', type: 'color' },
      { rawPath: ['s'], value: 16, type: 'dimension' },
      { rawPath: ['w'], value: 700, type: 'fontWeight' },
    ])
    expect(result.get('c')?.value).toBe('#ff0000') // already hex, round-trips
    expect(result.get('s')?.value).toBe('16px')
    expect(result.get('w')?.value).toBe(700) // fontWeight unchanged
  })
})

// ── available pipelines ───────────────────────────────────────────────────────

describe('defaultRegistry.pipelines()', () => {
  it('includes all built-in pipelines', () => {
    const names = defaultRegistry.pipelines()
    expect(names).toContain('default')
    expect(names).toContain('web')
    expect(names).toContain('web/rgb')
    expect(names).toContain('web/oklch')
    expect(names).toContain('ios')
    expect(names).toContain('android')
  })
})
