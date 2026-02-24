import { Effect, Data } from 'effect'
import type {
  TokenGroup,
  RawToken,
  FlatTokenMap,
  ResolvedToken,
  ThemeValue,
  TokenType,
} from '../types.js'

export class ResolveError extends Data.TaggedError('ResolveError')<{
  ref: string
  message?: string
}> {}

const ALIAS_RE = /^\{(.+)\}$/

function isRawToken(value: unknown): value is RawToken {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$value' in value &&
    (typeof (value as RawToken).$value === 'string' ||
      typeof (value as RawToken).$value === 'number')
  )
}

/** Flatten a token group tree into dot-path → RawToken, inheriting $type from parent groups */
function flatten(
  group: TokenGroup,
  pathParts: string[] = [],
  inheritedType?: TokenType,
): Map<string, { token: RawToken; rawPath: string[] }> {
  const result = new Map<string, { token: RawToken; rawPath: string[] }>()
  const groupType = (group.$type as TokenType | undefined) ?? inheritedType

  for (const key of Object.keys(group)) {
    if (key.startsWith('$')) continue
    const value = group[key]
    const currentPath = [...pathParts, key]

    if (isRawToken(value)) {
      const token: RawToken = {
        ...value,
        $type: value.$type ?? groupType,
      }
      result.set(currentPath.join('.'), { token, rawPath: currentPath })
    } else if (typeof value === 'object' && value !== null) {
      const nested = flatten(value as TokenGroup, currentPath, groupType)
      for (const [k, v] of nested) {
        result.set(k, v)
      }
    }
  }

  return result
}

/**
 * Collect all unique alias references from a token ($value + all $themes + all $breakpoints values).
 * Returns a Set of dot-paths referenced.
 */
function aliasRefs(token: RawToken): Set<string> {
  const refs = new Set<string>()

  const valueMatch = String(token.$value).match(ALIAS_RE)
  if (valueMatch) refs.add(valueMatch[1]!)

  if (token.$themes) {
    for (const themeVal of Object.values(token.$themes)) {
      const themeMatch = String(themeVal).match(ALIAS_RE)
      if (themeMatch) refs.add(themeMatch[1]!)
    }
  }

  if (token.$breakpoints) {
    for (const bpVal of Object.values(token.$breakpoints)) {
      const bpMatch = String(bpVal).match(ALIAS_RE)
      if (bpMatch) refs.add(bpMatch[1]!)
    }
  }

  return refs
}

/** Build a topological order for alias resolution using Kahn's algorithm.
 *  Includes both $value and $themes alias dependencies. */
function topoSort(
  flatMap: Map<string, { token: RawToken; rawPath: string[] }>,
): Effect.Effect<string[], ResolveError> {
  return Effect.try({
    try: () => {
      // deps[key] = set of unique tokens this key directly depends on
      const deps = new Map<string, Set<string>>()
      const dependents = new Map<string, string[]>()

      for (const key of flatMap.keys()) {
        deps.set(key, new Set())
        dependents.set(key, [])
      }

      for (const [key, { token }] of flatMap) {
        for (const ref of aliasRefs(token)) {
          if (!flatMap.has(ref)) {
            throw new ResolveError({ ref, message: `Alias not found: {${ref}}` })
          }
          deps.get(key)!.add(ref)
          dependents.get(ref)!.push(key)
        }
      }

      const inDegree = new Map<string, number>()
      for (const [key, refSet] of deps) {
        inDegree.set(key, refSet.size)
      }

      const queue: string[] = []
      for (const [key, deg] of inDegree) {
        if (deg === 0) queue.push(key)
      }

      const sorted: string[] = []
      while (queue.length > 0) {
        const node = queue.shift()!
        sorted.push(node)
        for (const dep of dependents.get(node) ?? []) {
          const newDeg = (inDegree.get(dep) ?? 0) - 1
          inDegree.set(dep, newDeg)
          if (newDeg === 0) queue.push(dep)
        }
      }

      if (sorted.length !== flatMap.size) {
        const cycleNode =
          [...inDegree.entries()].find(([, d]) => d > 0)?.[0] ?? 'unknown'
        throw new ResolveError({
          ref: cycleNode,
          message: `Circular alias reference detected near: ${cycleNode}`,
        })
      }

      return sorted
    },
    catch: (e) => {
      if (e instanceof ResolveError) return e
      return new ResolveError({ ref: 'unknown', message: String(e) })
    },
  })
}

/** Resolve a single value (possibly an alias) against the resolved-values map.
 *  Returns { value, aliasOf } where aliasOf is the direct alias dot-path if applicable. */
function resolveValue(
  raw: string | number,
  resolved: Map<string, string | number>,
  tokenKey: string,
): Effect.Effect<{ value: string | number; aliasOf?: string }, ResolveError> {
  return Effect.gen(function* () {
    const match = String(raw).match(ALIAS_RE)
    if (!match) {
      return { value: raw }
    }

    const ref = match[1]!
    if (!resolved.has(ref)) {
      return yield* Effect.fail(
        new ResolveError({ ref, message: `Alias not resolved: {${ref}} in token ${tokenKey}` }),
      )
    }

    return { value: resolved.get(ref)!, aliasOf: ref }
  })
}

export const resolveAliases = (
  group: TokenGroup,
): Effect.Effect<FlatTokenMap, ResolveError> =>
  Effect.gen(function* () {
    const flatRaw = flatten(group)
    const order = yield* topoSort(flatRaw)

    /** Tracks the concrete resolved value for each token path (used for alias chaining) */
    const resolved = new Map<string, string | number>()
    const result: FlatTokenMap = new Map()

    for (const key of order) {
      const entry = flatRaw.get(key)!
      const { token, rawPath } = entry

      // Resolve default value
      const { value, aliasOf } = yield* resolveValue(token.$value, resolved, key)
      resolved.set(key, value)

      // Resolve $themes values
      let themeValues: Record<string, ThemeValue> | undefined
      if (token.$themes) {
        themeValues = {}
        for (const [theme, rawThemeVal] of Object.entries(token.$themes)) {
          const { value: tv, aliasOf: tAlias } = yield* resolveValue(
            rawThemeVal,
            resolved,
            `${key}[$themes.${theme}]`,
          )
          themeValues[theme] = { value: tv, aliasOf: tAlias }
        }
      }

      // Resolve $breakpoints values
      let breakpointValues: Record<string, ThemeValue> | undefined
      if (token.$breakpoints) {
        breakpointValues = {}
        for (const [bp, rawBpVal] of Object.entries(token.$breakpoints)) {
          const { value: bv, aliasOf: bAlias } = yield* resolveValue(
            rawBpVal,
            resolved,
            `${key}[$breakpoints.${bp}]`,
          )
          breakpointValues[bp] = { value: bv, aliasOf: bAlias }
        }
      }

      const resolvedToken: ResolvedToken = {
        path: rawPath.join('-'),
        rawPath,
        value,
        aliasOf,
        type: token.$type ?? 'string',
        description: token.$description,
        themeValues,
        breakpointValues,
      }
      result.set(key, resolvedToken)
    }

    return result
  })
