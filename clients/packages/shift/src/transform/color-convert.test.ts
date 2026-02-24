import { describe, it, expect } from 'vitest'
import {
  parseColorRgba,
  toRgbString,
  toHexString,
  toHex8RgbaString,
  toHex8ArgbString,
  applyColorConvert,
} from './color-convert.js'

// ── parseColorRgba ────────────────────────────────────────────────────────────

describe('parseColorRgba', () => {
  it('parses #rrggbb (alpha defaults to 1)', () => {
    const result = parseColorRgba('#ff0000')
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1, 3)
    expect(result![1]).toBeCloseTo(0, 3)
    expect(result![2]).toBeCloseTo(0, 3)
    expect(result![3]).toBe(1)
  })

  it('parses #rgb shorthand', () => {
    const result = parseColorRgba('#f00')
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1, 3)
    expect(result![3]).toBe(1)
  })

  it('parses #rrggbbaa with alpha', () => {
    const result = parseColorRgba('#ff000080')
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1, 3)
    expect(result![3]).toBeCloseTo(0.502, 2)
  })

  it('parses #rgba 4-digit shorthand with alpha', () => {
    const result = parseColorRgba('#f008')
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1, 3)
    expect(result![3]).toBeCloseTo(0.533, 2)
  })

  it('parses rgb()', () => {
    const result = parseColorRgba('rgb(255, 0, 0)')
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1, 3)
    expect(result![3]).toBe(1)
  })

  it('parses rgba() with alpha', () => {
    const result = parseColorRgba('rgba(0, 0, 255, 0.5)')
    expect(result).not.toBeNull()
    expect(result![2]).toBeCloseTo(1, 3)
    expect(result![3]).toBeCloseTo(0.5, 3)
  })

  it('parses rgb() with space-separated values', () => {
    const result = parseColorRgba('rgb(255 0 0)')
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1, 3)
  })

  it('parses hsl()', () => {
    const result = parseColorRgba('hsl(0, 100%, 50%)')
    expect(result).not.toBeNull()
    expect(result![0]).toBeCloseTo(1, 2)
    expect(result![3]).toBe(1)
  })

  it('parses hsla() with alpha', () => {
    const result = parseColorRgba('hsla(240, 100%, 50%, 0.5)')
    expect(result).not.toBeNull()
    expect(result![2]).toBeCloseTo(1, 2)
    expect(result![3]).toBeCloseTo(0.5, 3)
  })

  it('returns null for named colors', () => {
    expect(parseColorRgba('blue')).toBeNull()
    expect(parseColorRgba('red')).toBeNull()
    expect(parseColorRgba('transparent')).toBeNull()
  })

  it('returns null for var() references', () => {
    expect(parseColorRgba('var(--color-primary)')).toBeNull()
  })

  it('returns null for oklch() values', () => {
    expect(parseColorRgba('oklch(0.628 0.258 29.23)')).toBeNull()
  })

  it('returns null for color-mix()', () => {
    expect(parseColorRgba('color-mix(in oklch, red, blue)')).toBeNull()
  })

  it('parses black', () => {
    expect(parseColorRgba('#000000')).toEqual([0, 0, 0, 1])
  })

  it('parses white', () => {
    expect(parseColorRgba('#ffffff')).toEqual([1, 1, 1, 1])
  })

  it('parses hex-only structured color objects', () => {
    const result = parseColorRgba({ hex: '#ff0000' } as any)
    expect(result).toEqual([1, 0, 0, 1])
  })

  it('rejects invalid structured objects that combine hex and components', () => {
    const result = parseColorRgba(
      { hex: '#ff0000', colorSpace: 'srgb', components: [1, 0, 0] } as any,
    )
    expect(result).toBeNull()
  })
})

// ── toRgbString ───────────────────────────────────────────────────────────────

describe('toRgbString', () => {
  it('produces rgb() for fully opaque values', () => {
    expect(toRgbString(1, 0, 0)).toBe('rgb(255, 0, 0)')
  })

  it('produces rgb() for white', () => {
    expect(toRgbString(1, 1, 1)).toBe('rgb(255, 255, 255)')
  })

  it('produces rgb() for black', () => {
    expect(toRgbString(0, 0, 0)).toBe('rgb(0, 0, 0)')
  })

  it('produces rgba() when alpha < 1', () => {
    const result = toRgbString(1, 0, 0, 0.5)
    expect(result).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('clamps values outside [0, 1]', () => {
    expect(toRgbString(2, -1, 0.5)).toBe('rgb(255, 0, 128)')
  })
})

// ── toHexString ───────────────────────────────────────────────────────────────

describe('toHexString', () => {
  it('converts red to #ff0000', () => {
    expect(toHexString(1, 0, 0)).toBe('#ff0000')
  })

  it('converts white to #ffffff', () => {
    expect(toHexString(1, 1, 1)).toBe('#ffffff')
  })

  it('converts black to #000000', () => {
    expect(toHexString(0, 0, 0)).toBe('#000000')
  })

  it('produces lowercase hex', () => {
    expect(toHexString(0, 0.4, 1)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

// ── toHex8RgbaString ──────────────────────────────────────────────────────────

describe('toHex8RgbaString', () => {
  it('produces #rrggbbff for fully opaque red', () => {
    expect(toHex8RgbaString(1, 0, 0)).toBe('#ff0000ff')
  })

  it('produces #rrggbbaa with 50% alpha', () => {
    const result = toHex8RgbaString(1, 0, 0, 0.5)
    expect(result.slice(0, 7)).toBe('#ff0000')
    expect(result).toHaveLength(9)
  })

  it('has alpha as the LAST two bytes (RGBA order)', () => {
    const result = toHex8RgbaString(1, 0, 0, 0)
    expect(result).toBe('#ff000000')
  })
})

// ── toHex8ArgbString ──────────────────────────────────────────────────────────

describe('toHex8ArgbString', () => {
  it('produces #ffrrggbb for fully opaque red', () => {
    expect(toHex8ArgbString(1, 0, 0)).toBe('#ffff0000')
  })

  it('has alpha as the FIRST two bytes (ARGB order)', () => {
    const result = toHex8ArgbString(1, 0, 0, 0)
    expect(result).toBe('#00ff0000')
  })

  it('differs from RGBA for same values', () => {
    const rgba = toHex8RgbaString(0.2, 0.4, 0.6, 0.8)
    const argb = toHex8ArgbString(0.2, 0.4, 0.6, 0.8)
    expect(rgba).not.toBe(argb)
    // RGBA: #rrggbbaa — first byte is red
    // ARGB: #aarrggbb — first byte is alpha
    expect(rgba.slice(1, 3)).toBe(argb.slice(3, 5)) // red byte
    expect(argb.slice(1, 3)).toBe(rgba.slice(7, 9)) // alpha byte
  })
})

// ── applyColorConvert ─────────────────────────────────────────────────────────

describe('applyColorConvert', () => {
  it('converts a parseable hex color', () => {
    const result = applyColorConvert('#ff0000', (r, g, b) => toHexString(r, g, b))
    expect(result).toBe('#ff0000')
  })

  it('passes through named colors unchanged', () => {
    expect(applyColorConvert('blue', toRgbString)).toBe('blue')
  })

  it('passes through var() references unchanged', () => {
    expect(applyColorConvert('var(--color-primary)', toRgbString)).toBe('var(--color-primary)')
  })

  it('passes through oklch() values unchanged', () => {
    const val = 'oklch(0.628 0.258 29.23)'
    expect(applyColorConvert(val, toRgbString)).toBe(val)
  })

  it('handles numeric input by passing through', () => {
    expect(applyColorConvert(700, toRgbString)).toBe('700')
  })

  it('converts rgb() to hex', () => {
    const result = applyColorConvert('rgb(255, 0, 0)', (r, g, b) => toHexString(r, g, b))
    expect(result).toBe('#ff0000')
  })

  it('converts hsl() to rgb', () => {
    const result = applyColorConvert('hsl(0, 100%, 50%)', toRgbString)
    expect(result).toMatch(/^rgb\(/)
    expect(result).toContain('255')
  })
})
