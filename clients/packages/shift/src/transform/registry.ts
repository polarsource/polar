import { Effect, Data } from 'effect'
import type { FlatTokenMap, ResolvedToken, ThemeValue } from '../types.js'

export class TransformError extends Data.TaggedError('TransformError')<{
  name: string
  path: string
  cause: string
}> {}

export interface ValueTransformDef {
  /** Returns true if this transform should be applied to the given token. */
  match: (token: ResolvedToken) => boolean
  /** Transform a single value; returns the converted value or fails. */
  transform: (
    value: string | number,
    token: ResolvedToken,
  ) => Effect.Effect<string | number, TransformError>
}

export class Registry {
  private _transforms = new Map<string, ValueTransformDef>()
  private _pipelines = new Map<string, string[]>()

  /** Register a named value transform. */
  register(name: string, def: ValueTransformDef): this {
    this._transforms.set(name, def)
    return this
  }

  /** Define a named pipeline as an ordered sequence of value transform names. */
  define(name: string, transformNames: string[]): this {
    this._pipelines.set(name, transformNames)
    return this
  }

  /** Return all registered pipeline names. */
  pipelines(): string[] {
    return [...this._pipelines.keys()]
  }

  /**
   * Apply a named pipeline to every token in the map.
   * Each value transform that matches a token is applied in sequence to the
   * token's value and to each themeValue entry.
   */
  apply(pipelineName: string, map: FlatTokenMap): Effect.Effect<FlatTokenMap, TransformError> {
    const self = this
    return Effect.gen(function* () {
      const names = self._pipelines.get(pipelineName)
      if (!names) {
        const available = [...self._pipelines.keys()].join(', ')
        return yield* Effect.fail(
          new TransformError({
            name: pipelineName,
            path: '',
            cause: `Unknown pipeline: "${pipelineName}". Available: ${available}`,
          }),
        )
      }

      const transforms: Array<[string, ValueTransformDef]> = []
      for (const tname of names) {
        const def = self._transforms.get(tname)
        if (!def) {
          return yield* Effect.fail(
            new TransformError({
              name: tname,
              path: '',
              cause: `Unknown value transform: "${tname}"`,
            }),
          )
        }
        transforms.push([tname, def])
      }

      const applyToValue = (
        value: string | number,
        token: ResolvedToken,
      ): Effect.Effect<string | number, TransformError> =>
        Effect.gen(function* () {
          let v = value
          for (const [, def] of transforms) {
            if (def.match(token)) {
              v = yield* def.transform(v, token)
            }
          }
          return v
        })

      const result: FlatTokenMap = new Map()
      for (const [key, token] of map) {
        const value = yield* applyToValue(token.value, token)

        let themeValues = token.themeValues
        if (themeValues) {
          const newThemeValues: Record<string, ThemeValue> = {}
          for (const [theme, tv] of Object.entries(themeValues)) {
            const tvValue = yield* applyToValue(tv.value, token)
            newThemeValues[theme] = { ...tv, value: tvValue }
          }
          themeValues = newThemeValues
        }

        let breakpointValues = token.breakpointValues
        if (breakpointValues) {
          const newBpValues: Record<string, ThemeValue> = {}
          for (const [bp, bv] of Object.entries(breakpointValues)) {
            const bvValue = yield* applyToValue(bv.value, token)
            newBpValues[bp] = { ...bv, value: bvValue }
          }
          breakpointValues = newBpValues
        }

        result.set(key, { ...token, value, themeValues, breakpointValues })
      }

      return result
    })
  }
}
