import { Effect, Data } from 'effect'
import type { FlatTokenMap, ResolvedToken, ThemeValue } from '../types.js'

export class DimensionTransformError extends Data.TaggedError(
  'DimensionTransformError',
)<{
  path: string
  cause: string
}> {}

function normalizeDimension(
  value: string | number,
  path: string,
): Effect.Effect<string, DimensionTransformError> {
  if (typeof value === 'number') {
    return Effect.succeed(`${value}px`)
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
