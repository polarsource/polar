import { Effect } from 'effect'
import { Registry, TransformError, type ValueTransformDef } from './registry.js'
import {
  applyColorConvert,
  stringifyColorValue,
  toRgbString,
  toHexString,
  toHex8RgbaString,
  toHex8ArgbString,
} from './color-convert.js'
import { toOklchString } from './oklch.js'
import type { DimensionValue, ResolvedToken, TokenValue } from '../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function colorTransform(
  converter: (r: number, g: number, b: number, a: number) => string,
): ValueTransformDef {
  return {
    match: (token: ResolvedToken) => token.type === 'color',
    transform: (value: TokenValue) =>
      Effect.succeed(applyColorConvert(value, converter)),
  }
}

function isDimensionValue(value: TokenValue): value is DimensionValue {
  return typeof value === 'object' && value !== null && 'value' in value && 'unit' in value
}

// ── Registry factory ──────────────────────────────────────────────────────────

export function createDefaultRegistry(): Registry {
  const registry = new Registry()

  // ── Color value transforms ─────────────────────────────────────────────────

  registry.register('color/css', {
    match: (token) => token.type === 'color',
    transform: (value) => Effect.succeed(stringifyColorValue(value)),
  })

  /** color/rgb — convert any parseable color to rgb() / rgba(). */
  registry.register('color/rgb', colorTransform(toRgbString))

  /** color/hex — convert any parseable color to #rrggbb hex. */
  registry.register('color/hex', colorTransform((r, g, b) => toHexString(r, g, b)))

  /** color/hex8rgba — convert any parseable color to #rrggbbaa (CSS/PNG order). */
  registry.register('color/hex8rgba', colorTransform(toHex8RgbaString))

  /** color/hex8argb — convert any parseable color to #aarrggbb (Android/Windows order). */
  registry.register('color/hex8argb', colorTransform(toHex8ArgbString))

  /** color/oklch — convert any parseable color to oklch(L C H). */
  registry.register('color/oklch', {
    match: (token) => token.type === 'color',
    transform: (value) => Effect.succeed(toOklchString(value)),
  })

  // ── Dimension value transforms ─────────────────────────────────────────────

  /**
   * dimension/px — ensure dimension tokens carry a px (or other CSS unit) suffix.
   * Bare numbers and bare numeric strings are suffixed with "px".
   */
  registry.register('dimension/px', {
    match: (token) => token.type === 'dimension',
    transform: (value, token) => {
      if (isDimensionValue(value)) return Effect.succeed(`${value.value}${value.unit}`)
      if (typeof value === 'number') return Effect.succeed(`${value}px`)
      const str = String(value).trim()
      if (/^-?[\d.]+$/.test(str)) return Effect.succeed(`${str}px`)
      if (/^-?[\d.]+(px|rem|em|%|vh|vw|vmin|vmax|ch|ex)$/.test(str)) return Effect.succeed(str)
      return Effect.fail(
        new TransformError({
          name: 'dimension/px',
          path: token.path,
          cause: `Invalid dimension value: "${str}"`,
        }),
      )
    },
  })

  // ── Pipelines ──────────────────────────────────────────────────────────────

  /** default — normalize dimensions; colors are passed through unchanged. */
  registry.define('default', ['color/css', 'dimension/px'])

  /** web — #rrggbb hex colors + normalized dimensions. */
  registry.define('web', ['color/css', 'color/hex', 'dimension/px'])

  /** web/rgb — rgb() colors + normalized dimensions. */
  registry.define('web/rgb', ['color/css', 'color/rgb', 'dimension/px'])

  /** web/oklch — oklch() colors + normalized dimensions. */
  registry.define('web/oklch', ['color/css', 'color/oklch', 'dimension/px'])

  /** ios — #aarrggbb ARGB hex colors + normalized dimensions. */
  registry.define('ios', ['color/css', 'color/hex8argb', 'dimension/px'])

  /** android — #aarrggbb ARGB hex colors + normalized dimensions. */
  registry.define('android', ['color/css', 'color/hex8argb', 'dimension/px'])

  return registry
}

export const defaultRegistry = createDefaultRegistry()
