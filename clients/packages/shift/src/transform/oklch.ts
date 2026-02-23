import { Effect, Data } from 'effect'
import type { FlatTokenMap, ResolvedToken, ThemeValue } from '../types.js'

export class OklchTransformError extends Data.TaggedError('OklchTransformError')<{
  path: string
  cause: string
}> {}

// ── Parsing ───────────────────────────────────────────────────────────────────

/** Parse #rgb / #rrggbb / #rgba / #rrggbbaa → [r, g, b] in [0, 1]. */
function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim()
  if (!hex.startsWith('#')) return null
  const h = hex.slice(1)

  if (h.length === 3 || h.length === 4) {
    const r = parseInt(h[0]! + h[0]!, 16) / 255
    const g = parseInt(h[1]! + h[1]!, 16) / 255
    const b = parseInt(h[2]! + h[2]!, 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return [r, g, b]
  }

  if (h.length === 6 || h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16) / 255
    const g = parseInt(h.slice(2, 4), 16) / 255
    const b = parseInt(h.slice(4, 6), 16) / 255
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return [r, g, b]
  }

  return null
}

/** Parse rgb() / rgba() (both comma-separated and space-separated) → [r, g, b] in [0, 1]. */
function parseRgb(value: string): [number, number, number] | null {
  const v = value.trim()
  const match = v.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i)
  if (!match) return null
  const r = parseFloat(match[1]!) / 255
  const g = parseFloat(match[2]!) / 255
  const b = parseFloat(match[3]!) / 255
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null
  return [r, g, b]
}

/** hsl(h, s%, l%) → [r, g, b] in [0, 1]. */
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

/** Parse hsl() / hsla() → [r, g, b] in [0, 1]. */
function parseHsl(value: string): [number, number, number] | null {
  const v = value.trim()
  const match = v.match(/^hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/i)
  if (!match) return null
  const h = parseFloat(match[1]!) / 360
  const s = parseFloat(match[2]!) / 100
  const l = parseFloat(match[3]!) / 100
  if (isNaN(h) || isNaN(s) || isNaN(l)) return null
  return hslToRgb(h, s, l)
}

/** Return true if the value is already in oklch() notation. */
function isOklch(value: string): boolean {
  return /^oklch\s*\(/i.test(value.trim())
}

/**
 * Try to parse a CSS color string into sRGB [0, 1] components.
 * Returns null for values it cannot parse (named colors, var(), oklch(), etc.).
 */
export function parseColor(value: string): [number, number, number] | null {
  const v = String(value).trim()
  return parseHex(v) ?? parseRgb(v) ?? parseHsl(v)
}

// ── Conversion math ───────────────────────────────────────────────────────────

/** sRGB component → linear light value (inverse gamma). */
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * Convert sRGB [0, 1] to OKLCH [L, C, H].
 * L ∈ [0, 1], C ∈ [0, ~0.4], H ∈ [0, 360).
 *
 * Algorithm: Björn Ottosson's OKLab (2020).
 * https://bottosson.github.io/posts/oklab/
 */
export function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
  // linear sRGB
  const lr = linearize(r)
  const lg = linearize(g)
  const lb = linearize(b)

  // linear sRGB → LMS (M1, direct — Ottosson 2020, no XYZ intermediate)
  const lms_l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const lms_m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const lms_s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  // Cube root (non-linear response)
  const l_ = Math.cbrt(lms_l)
  const m_ = Math.cbrt(lms_m)
  const s_ = Math.cbrt(lms_s)

  // LMS → OKLab (M2)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

  // OKLab → OKLCH (polar)
  const C = Math.sqrt(a * a + bv * bv)
  const H = ((Math.atan2(bv, a) * 180) / Math.PI + 360) % 360

  return [L, C, H]
}

// ── Formatting ────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/**
 * Convert any parseable CSS color value to an `oklch(L C H)` string.
 * Returns the original value if it is not parseable (named colors, var(), etc.)
 * or is already in oklch() notation.
 */
export function toOklchString(value: string | number): string {
  const str = String(value).trim()
  if (isOklch(str)) return str

  const rgb = parseColor(str)
  if (!rgb) return str

  const [L, C, H] = rgbToOklch(...rgb)
  return `oklch(${round(L, 4)} ${round(C, 4)} ${round(H, 2)})`
}

// ── Transform stage ───────────────────────────────────────────────────────────

function convertValue(
  value: string | number,
  path: string,
): Effect.Effect<string, OklchTransformError> {
  const result = toOklchString(value)
  if (result === String(value).trim() && !isOklch(String(value).trim())) {
    // Couldn't parse — pass through silently (named colors, var(), etc.)
    return Effect.succeed(result)
  }
  if (result.length === 0) {
    return Effect.fail(new OklchTransformError({ path, cause: 'Empty color value' }))
  }
  return Effect.succeed(result)
}

/**
 * Convert all `color` tokens in a FlatTokenMap to `oklch()` notation.
 * Tokens whose values cannot be parsed (named colors, `var()`, existing `oklch()`)
 * are passed through unchanged.
 */
export const transformOklch = (
  map: FlatTokenMap,
): Effect.Effect<FlatTokenMap, OklchTransformError> =>
  Effect.gen(function* () {
    const result: FlatTokenMap = new Map()

    for (const [key, token] of map) {
      if (token.type !== 'color') {
        result.set(key, token)
        continue
      }

      const converted = yield* convertValue(token.value, token.path)

      // Convert theme values
      let themeValues = token.themeValues
      if (themeValues) {
        const convertedThemes: Record<string, ThemeValue> = {}
        for (const [theme, tv] of Object.entries(themeValues)) {
          const cv = yield* convertValue(tv.value, `${token.path}[${theme}]`)
          convertedThemes[theme] = { ...tv, value: cv }
        }
        themeValues = convertedThemes
      }

      const updated: ResolvedToken = { ...token, value: converted, themeValues }
      result.set(key, updated)
    }

    return result
  })
