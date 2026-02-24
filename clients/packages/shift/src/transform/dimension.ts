import { Effect, Data } from 'effect'
import type { DimensionValue, FlatTokenMap, ResolvedToken, ThemeValue, TokenValue } from '../types.js'

export class DimensionTransformError extends Data.TaggedError(
  'DimensionTransformError',
)<{
  path: string
  cause: string
}> {}

function isDimensionValue(value: TokenValue): value is DimensionValue {
  return typeof value === 'object' && value !== null && 'value' in value && 'unit' in value
}

function normalizeDimension(
  value: TokenValue,
  path: string,
): Effect.Effect<string, DimensionTransformError> {
  if (isDimensionValue(value)) {
    return Effect.succeed(`${value.value}${value.unit}`)
  }
  if (typeof value === 'number') {
    return Effect.succeed(`${value}px`)
  }
  if (typeof value !== 'string') {
    return Effect.fail(
      new DimensionTransformError({
        path,
        cause: `Invalid dimension value: "${JSON.stringify(value)}"`,
      }),
    )
  }
  const str = value.trim()
  if (/^-?[\d.]+$/.test(str)) {
    return Effect.succeed(`${str}px`)
  }
  if (/^-?[\d.]+(px|rem|em|%|vh|vw|vmin|vmax|ch|ex)$/.test(str)) {
    return Effect.succeed(str)
  }
  return Effect.fail(
    new DimensionTransformError({
      path,
      cause: `Invalid dimension value: "${str}"`,
    }),
  )
}

export const transformDimensions = (
  map: FlatTokenMap,
): Effect.Effect<FlatTokenMap, DimensionTransformError> =>
  Effect.gen(function* () {
    const result: FlatTokenMap = new Map()

    for (const [key, token] of map) {
      if (token.type !== 'dimension') {
        result.set(key, token)
        continue
      }

      const normalized = yield* normalizeDimension(token.value, token.path)

      // Normalize theme values
      let themeValues = token.themeValues
      if (themeValues) {
        const normalized_themes: Record<string, ThemeValue> = {}
        for (const [theme, tv] of Object.entries(themeValues)) {
          const nv = yield* normalizeDimension(tv.value, `${token.path}[${theme}]`)
          normalized_themes[theme] = { ...tv, value: nv }
        }
        themeValues = normalized_themes
      }

      const updated: ResolvedToken = { ...token, value: normalized, themeValues }
      result.set(key, updated)
    }

    return result
  })
