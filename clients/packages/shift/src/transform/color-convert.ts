import type { ColorValue, TokenValue } from '../types.js'

// ── HSL helper ────────────────────────────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number): number => {
    const tt = ((t % 1) + 1) % 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)]
}

function isColorValue(value: unknown): value is ColorValue {
  if (typeof value !== 'object' || value === null) return false
  const hasHex = typeof (value as { hex?: unknown }).hex === 'string'
  const hasColorSpace = 'colorSpace' in value
  const hasComponents = Array.isArray((value as { components?: unknown }).components)
  if (hasHex && (hasColorSpace || hasComponents)) return false
  if (hasHex) return true
  return hasColorSpace && hasComponents
}

function formatAlpha(alpha?: number): string {
  if (alpha === undefined || alpha === 1) return ''
  return ` / ${roundTo(alpha, 3)}`
}

function serializeColorObject(value: ColorValue): string {
  if ('hex' in value) {
    return value.hex
  }
  const alpha = formatAlpha(value.alpha)
  switch (value.colorSpace) {
    case 'srgb': {
      const [r = 0, g = 0, b = 0] = value.components
      return `rgb(${toByte(r)}, ${toByte(g)}, ${toByte(b)}${alpha})`
    }
    case 'display-p3': {
      const [r = 0, g = 0, b = 0] = value.components
      return `color(display-p3 ${roundTo(r, 6)} ${roundTo(g, 6)} ${roundTo(b, 6)}${alpha})`
    }
    case 'hsl': {
      const [h = 0, s = 0, l = 0] = value.components
      const sPct = s <= 1 ? s * 100 : s
      const lPct = l <= 1 ? l * 100 : l
      return `hsl(${roundTo(h, 3)} ${roundTo(sPct, 3)}% ${roundTo(lPct, 3)}%${alpha})`
    }
    case 'oklch': {
      const [L = 0, C = 0, H = 0] = value.components
      return `oklch(${roundTo(L, 4)} ${roundTo(C, 4)} ${roundTo(H, 2)}${alpha})`
    }
    default:
      return ''
  }
}

// ── Parsers ───────────────────────────────────────────────────────────────────

/** Parse #rgb / #rgba / #rrggbb / #rrggbbaa → [r, g, b, a] in [0, 1]. */
function parseHexRgba(value: string): [number, number, number, number] | null {
  if (!value.startsWith('#')) return null
  const h = value.slice(1)

  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16) / 255
    const g = parseInt(h[1]! + h[1]!, 16) / 255
    const b = parseInt(h[2]! + h[2]!, 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return [r, g, b, 1]
  }

  if (h.length === 4) {
    const r = parseInt(h[0]! + h[0]!, 16) / 255
    const g = parseInt(h[1]! + h[1]!, 16) / 255
    const b = parseInt(h[2]! + h[2]!, 16) / 255
    const a = parseInt(h[3]! + h[3]!, 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null
    return [r, g, b, a]
  }

  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return [r, g, b, 1]
  }

  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    const a = parseInt(h.slice(6, 8), 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null
    return [r, g, b, a]
  }

  return null
}

/** Parse rgb() / rgba() (comma- or space-separated) → [r, g, b, a] in [0, 1]. */
function parseRgbRgba(value: string): [number, number, number, number] | null {
  const match = value.match(
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i,
  )
  if (!match) return null
  const r = parseFloat(match[1]!) / 255
  const g = parseFloat(match[2]!) / 255
  const b = parseFloat(match[3]!) / 255
  const a = match[4] !== undefined ? parseFloat(match[4]!) : 1
  if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null
  return [r, g, b, a]
}

/** Parse hsl() / hsla() → [r, g, b, a] in [0, 1]. */
function parseHslRgba(value: string): [number, number, number, number] | null {
  const match = value.match(
    /^hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+))?\s*\)/i,
  )
  if (!match) return null
  const h = parseFloat(match[1]!) / 360
  const s = parseFloat(match[2]!) / 100
  const l = parseFloat(match[3]!) / 100
  const a = match[4] !== undefined ? parseFloat(match[4]!) : 1
  if (isNaN(h) || isNaN(s) || isNaN(l) || isNaN(a)) return null
  const [r, g, b] = hslToRgb(h, s, l)
  return [r, g, b, a]
}

function parseColorObjectRgba(value: ColorValue): [number, number, number, number] | null {
  if ('hex' in value) {
    const parsed = parseHexRgba(value.hex)
    if (!parsed) return null
    if (value.alpha === undefined) return parsed
    return [parsed[0], parsed[1], parsed[2], value.alpha]
  }
  const alpha = value.alpha ?? 1
  switch (value.colorSpace) {
    case 'srgb':
    case 'display-p3': {
      const [r = 0, g = 0, b = 0] = value.components
      return [r, g, b, alpha]
    }
    case 'hsl': {
      const [hRaw = 0, sRaw = 0, lRaw = 0] = value.components
      const h = hRaw / 360
      const s = sRaw <= 1 ? sRaw : sRaw / 100
      const l = lRaw <= 1 ? lRaw : lRaw / 100
      const [r, g, b] = hslToRgb(h, s, l)
      return [r, g, b, alpha]
    }
    case 'oklch':
      return null
    default:
      return null
  }
}

/**
 * Try to parse any CSS color string to [r, g, b, a] in [0, 1].
 * Returns null for values that cannot be parsed: named colors, var(), oklch(),
 * color-mix(), etc.
 */
export function parseColorRgba(value: TokenValue): [number, number, number, number] | null {
  if (isColorValue(value)) {
    return parseColorObjectRgba(value)
  }
  const v = String(value).trim()
  return parseHexRgba(v) ?? parseRgbRgba(v) ?? parseHslRgba(v)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function toByte(n: number): number {
  return Math.round(clamp01(n) * 255)
}

function byteHex(n: number): string {
  return n.toString(16).padStart(2, '0')
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

// ── Color format converters ───────────────────────────────────────────────────

/** RGBA [0,1] → `rgb(R, G, B)` or `rgba(R, G, B, A)` string. */
export function toRgbString(r: number, g: number, b: number, a = 1): string {
  const R = toByte(r),
    G = toByte(g),
    B = toByte(b)
  if (roundTo(a, 3) === 1) return `rgb(${R}, ${G}, ${B})`
  return `rgba(${R}, ${G}, ${B}, ${roundTo(a, 3)})`
}

/** RGB [0,1] → `#rrggbb` hex string. */
export function toHexString(r: number, g: number, b: number): string {
  return `#${byteHex(toByte(r))}${byteHex(toByte(g))}${byteHex(toByte(b))}`
}

/** RGBA [0,1] → `#rrggbbaa` hex string (CSS / PNG order). */
export function toHex8RgbaString(r: number, g: number, b: number, a = 1): string {
  return `#${byteHex(toByte(r))}${byteHex(toByte(g))}${byteHex(toByte(b))}${byteHex(toByte(a))}`
}

/** RGBA [0,1] → `#aarrggbb` hex string (Android / Windows ARGB order). */
export function toHex8ArgbString(r: number, g: number, b: number, a = 1): string {
  return `#${byteHex(toByte(a))}${byteHex(toByte(r))}${byteHex(toByte(g))}${byteHex(toByte(b))}`
}

// ── Generic convert helper ────────────────────────────────────────────────────

/**
 * Apply a color converter to a CSS color value.
 * Returns the original string unchanged if the value cannot be parsed
 * (named colors, var(), oklch(), color-mix(), etc.).
 */
export function applyColorConvert(
  value: TokenValue,
  converter: (r: number, g: number, b: number, a: number) => string,
): string {
  const rgba = parseColorRgba(value)
  if (!rgba) return stringifyColorValue(value)
  return converter(rgba[0], rgba[1], rgba[2], rgba[3])
}

export function stringifyColorValue(value: TokenValue): string {
  if (isColorValue(value)) {
    return serializeColorObject(value)
  }
  return String(value).trim()
}
