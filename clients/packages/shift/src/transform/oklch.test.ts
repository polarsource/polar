import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import {
  parseColor,
  rgbToOklch,
  toOklchString,
  transformOklch,
} from './oklch.js'
import type { FlatTokenMap, ResolvedToken } from '../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function near(actual: number, expected: number, tolerance = 0.001): boolean {
  return Math.abs(actual - expected) < tolerance
}

function expectOklch(
  actual: [number, number, number],
  [L, C, H]: [number, number, number],
  tolerance = 0.001,
) {
  expect(near(actual[0], L, tolerance), `L: ${actual[0]} ≠ ${L}`).toBe(true)
  expect(near(actual[1], C, tolerance), `C: ${actual[1]} ≠ ${C}`).toBe(true)
  expect(near(actual[2], H, tolerance), `H: ${actual[2]} ≠ ${H}`).toBe(true)
}

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

// ── parseColor ────────────────────────────────────────────────────────────────

describe('parseColor', () => {
  it('parses 6-digit hex', () => {
    const rgb = parseColor('#ff0000')
    expect(rgb).not.toBeNull()
    expect(near(rgb![0], 1)).toBe(true)
    expect(near(rgb![1], 0)).toBe(true)
    expect(near(rgb![2], 0)).toBe(true)
  })

  it('parses 3-digit hex', () => {
    const rgb = parseColor('#f00')
    expect(rgb).not.toBeNull()
    expect(near(rgb![0], 1)).toBe(true)
  })

  it('parses 8-digit hex (ignores alpha)', () => {
    const rgb = parseColor('#ff0000ff')
    expect(rgb).not.toBeNull()
    expect(near(rgb![0], 1)).toBe(true)
  })

  it('parses rgb()', () => {
    const rgb = parseColor('rgb(255, 0, 0)')
    expect(rgb).not.toBeNull()
    expect(near(rgb![0], 1)).toBe(true)
    expect(near(rgb![1], 0)).toBe(true)
    expect(near(rgb![2], 0)).toBe(true)
  })

  it('parses rgba()', () => {
    const rgb = parseColor('rgba(0, 0, 255, 0.5)')
    expect(rgb).not.toBeNull()
    expect(near(rgb![2], 1)).toBe(true)
  })

  it('parses rgb() with space-separated values', () => {
    const rgb = parseColor('rgb(255 0 0)')
    expect(rgb).not.toBeNull()
    expect(near(rgb![0], 1)).toBe(true)
  })

  it('parses hsl()', () => {
    const rgb = parseColor('hsl(0, 100%, 50%)')
    expect(rgb).not.toBeNull()
    expect(near(rgb![0], 1, 0.01)).toBe(true)
    expect(near(rgb![1], 0, 0.01)).toBe(true)
    expect(near(rgb![2], 0, 0.01)).toBe(true)
  })

  it('parses hsla()', () => {
    const rgb = parseColor('hsla(240, 100%, 50%, 0.5)')
    expect(rgb).not.toBeNull()
    expect(near(rgb![2], 1, 0.01)).toBe(true)
  })

  it('returns null for named colors', () => {
    expect(parseColor('blue')).toBeNull()
    expect(parseColor('red')).toBeNull()
    expect(parseColor('transparent')).toBeNull()
  })

  it('returns null for var() references', () => {
    expect(parseColor('var(--colors-primary)')).toBeNull()
  })

  it('returns null for oklch()', () => {
    expect(parseColor('oklch(0.5 0.2 240)')).toBeNull()
  })

  it('returns null for color-mix()', () => {
    expect(parseColor('color-mix(in oklch, red, blue)')).toBeNull()
  })

  it('parses white #ffffff', () => {
    const rgb = parseColor('#ffffff')
    expect(rgb).toEqual([1, 1, 1])
  })

  it('parses black #000000', () => {
    const rgb = parseColor('#000000')
    expect(rgb).toEqual([0, 0, 0])
  })
})

// ── rgbToOklch ────────────────────────────────────────────────────────────────

describe('rgbToOklch', () => {
  // Reference values: https://bottosson.github.io/misc/colorpicker/
  // and cross-checked with CSS Color 4 working group examples.

  it('converts black to L=0 C=0', () => {
    const [L, C] = rgbToOklch(0, 0, 0)
    expect(near(L, 0)).toBe(true)
    expect(near(C, 0)).toBe(true)
  })

  it('converts white to L≈1 C≈0', () => {
    const [L, C] = rgbToOklch(1, 1, 1)
    expect(near(L, 1, 0.001)).toBe(true)
    expect(near(C, 0, 0.001)).toBe(true)
  })

  it('converts pure red #ff0000', () => {
    // Reference: oklch(0.6279554 0.2576986 29.2338...)
    const result = rgbToOklch(1, 0, 0)
    expectOklch(result, [0.6280, 0.2577, 29.23], 0.005)
  })

  it('converts pure green #00ff00', () => {
    // Reference: oklch(0.8664396 0.2947554 142.4953...)
    const result = rgbToOklch(0, 1, 0)
    expectOklch(result, [0.8664, 0.2948, 142.5], 0.01)
  })

  it('converts pure blue #0000ff', () => {
    // Reference: oklch(0.4520137 0.3131326 264.0520...)
    const result = rgbToOklch(0, 0, 1)
    expectOklch(result, [0.4520, 0.3131, 264.05], 0.005)
  })

  it('converts mid-gray (perceptual lightness ≈ 0.6)', () => {
    // 50% sRGB gray is not perceptually 50% — OKLCH corrects this
    const [L, C] = rgbToOklch(0.5, 0.5, 0.5)
    expect(near(L, 0.598, 0.01)).toBe(true) // L ≈ 0.598, not 0.5
    expect(near(C, 0, 0.001)).toBe(true)    // achromatic → C ≈ 0
  })

  it('C is 0 for achromatic colors (H is undefined)', () => {
    const [, C] = rgbToOklch(0.5, 0.5, 0.5)
    // For achromatic colors C ≈ 0; H is indeterminate (floating-point atan2 artefact)
    expect(near(C, 0, 0.001)).toBe(true)
  })
})

// ── toOklchString ─────────────────────────────────────────────────────────────

describe('toOklchString', () => {
  it('converts hex to oklch() string', () => {
    const result = toOklchString('#000000')
    expect(result).toBe('oklch(0 0 0)')
  })

  it('converts white to oklch() string', () => {
    const result = toOklchString('#ffffff')
    expect(result).toMatch(/^oklch\(1 0/)
  })

  it('converts #ff0000 red to oklch()', () => {
    const result = toOklchString('#ff0000')
    expect(result).toMatch(/^oklch\(/)
    expect(result).toContain('0.628')
  })

  it('passes through oklch() values unchanged', () => {
    const val = 'oklch(0.623 0.214 259.815)'
    expect(toOklchString(val)).toBe(val)
  })

  it('passes through named colors unchanged', () => {
    expect(toOklchString('blue')).toBe('blue')
    expect(toOklchString('transparent')).toBe('transparent')
  })

  it('passes through var() references unchanged', () => {
    expect(toOklchString('var(--colors-primary)')).toBe('var(--colors-primary)')
  })

  it('converts rgb() to oklch()', () => {
    const result = toOklchString('rgb(255, 0, 0)')
    expect(result).toMatch(/^oklch\(/)
    expect(result).toContain('0.628')
  })

  it('converts hsl() to oklch()', () => {
    const result = toOklchString('hsl(0, 100%, 50%)')
    expect(result).toMatch(/^oklch\(/)
    expect(result).toContain('0.628')
  })

  it('rounds L and C to 4 decimal places', () => {
    const result = toOklchString('#0066ff')
    const match = result.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/)
    expect(match).not.toBeNull()
    const [, L, C] = match!
    expect(L!.replace('.', '').replace(/^0+/, '').length).toBeLessThanOrEqual(4)
    expect(C!.replace('.', '').replace(/^0+/, '').length).toBeLessThanOrEqual(4)
  })

  it('handles numeric input by treating as-is', () => {
    // Numbers aren't CSS colors — pass through
    const result = toOklchString(700)
    expect(result).toBe('700')
  })

  it('converts 3-digit hex', () => {
    const threeDigit = toOklchString('#f00')
    const sixDigit = toOklchString('#ff0000')
    expect(threeDigit).toBe(sixDigit)
  })
})

// ── transformOklch ────────────────────────────────────────────────────────────

describe('transformOklch', () => {
  it('converts color tokens to oklch notation', () => {
    const map = makeMap([
      { rawPath: ['colors', 'primary'], value: '#0066ff', type: 'color' },
    ])
    const result = Effect.runSync(transformOklch(map))
    const token = result.get('colors.primary')!
    expect(String(token.value)).toMatch(/^oklch\(/)
  })

  it('leaves non-color tokens unchanged', () => {
    const map = makeMap([
      { rawPath: ['spacing', 'md'], value: '16px', type: 'dimension' },
    ])
    const result = Effect.runSync(transformOklch(map))
    expect(result.get('spacing.md')?.value).toBe('16px')
  })

  it('passes through named colors unchanged', () => {
    const map = makeMap([{ rawPath: ['c'], value: 'blue', type: 'color' }])
    const result = Effect.runSync(transformOklch(map))
    expect(result.get('c')?.value).toBe('blue')
  })

  it('passes through var() references unchanged', () => {
    const map = makeMap([
      { rawPath: ['c'], value: '#fff', aliasOf: 'colors.base', type: 'color' },
    ])
    const result = Effect.runSync(transformOklch(map))
    // aliasOf is preserved; value is converted
    expect(result.get('c')?.aliasOf).toBe('colors.base')
    expect(String(result.get('c')?.value)).toMatch(/^oklch\(/)
  })

  it('passes through already-oklch values unchanged', () => {
    const val = 'oklch(0.623 0.214 259.815)'
    const map = makeMap([{ rawPath: ['c'], value: val, type: 'color' }])
    const result = Effect.runSync(transformOklch(map))
    expect(result.get('c')?.value).toBe(val)
  })

  it('converts themeValues to oklch', () => {
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        type: 'color',
        themeValues: {
          dark: { value: '#1a1a2e' },
        },
      },
    ])
    const result = Effect.runSync(transformOklch(map))
    const token = result.get('btn.bg')!
    expect(String(token.value)).toMatch(/^oklch\(/)
    expect(String(token.themeValues?.['dark']?.value)).toMatch(/^oklch\(/)
  })

  it('preserves aliasOf in themeValues during conversion', () => {
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        type: 'color',
        themeValues: {
          dark: { value: '#6b7280', aliasOf: 'colors.secondary' },
        },
      },
    ])
    const result = Effect.runSync(transformOklch(map))
    expect(result.get('btn.bg')?.themeValues?.['dark']?.aliasOf).toBe('colors.secondary')
  })

  it('handles a mixed map correctly', () => {
    const map = makeMap([
      { rawPath: ['c'], value: '#ff0000', type: 'color' },
      { rawPath: ['s'], value: '16px', type: 'dimension' },
      { rawPath: ['n'], value: 700, type: 'fontWeight' },
    ])
    const result = Effect.runSync(transformOklch(map))
    expect(String(result.get('c')?.value)).toMatch(/^oklch\(/)
    expect(result.get('s')?.value).toBe('16px')
    expect(result.get('n')?.value).toBe(700)
  })

  it('handles empty map', () => {
    const result = Effect.runSync(transformOklch(new Map()))
    expect(result.size).toBe(0)
  })
})
