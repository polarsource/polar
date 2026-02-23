import { Effect, Data } from 'effect'
import type { FlatTokenMap, ResolvedToken, ThemeValue } from '../types.js'

export class TransformError extends Data.TaggedError('TransformError')<{
  path: string
  cause: string
}> {}

function normalizeColor(
  value: string | number,
  path: string,
): Effect.Effect<string, TransformError> {
  const str = String(value).trim()
  if (str.length === 0) {
    return Effect.fail(new TransformError({ path, cause: 'Empty color value' }))
  }
  return Effect.succeed(str)
}

export const transformColors = (
  map: FlatTokenMap,
): Effect.Effect<FlatTokenMap, TransformError> =>
  Effect.gen(function* () {
    const result: FlatTokenMap = new Map()

    for (const [key, token] of map) {
      if (token.type !== 'color') {
        result.set(key, token)
        continue
      }

      // Normalize default value (skip if proxying via aliasOf — value is a var() target)
      const normalized = yield* normalizeColor(token.value, token.path)

      // Normalize theme values
      let themeValues = token.themeValues
      if (themeValues) {
        const normalized_themes: Record<string, ThemeValue> = {}
        for (const [theme, tv] of Object.entries(themeValues)) {
          const nv = yield* normalizeColor(tv.value, `${token.path}[${theme}]`)
          normalized_themes[theme] = { ...tv, value: nv }
        }
        themeValues = normalized_themes
      }

      const updated: ResolvedToken = { ...token, value: normalized, themeValues }
      result.set(key, updated)
    }

    return result
  })
