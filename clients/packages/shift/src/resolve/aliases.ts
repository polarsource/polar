import { Effect, Data } from 'effect'
import type {
  DimensionValue,
  TokenGroup,
  RawToken,
  FlatTokenMap,
  ResolvedToken,
  ThemeValue,
  TokenValue,
} from '../types.js'

export class ResolveError extends Data.TaggedError('ResolveError')<{
  ref: string
  message?: string
}> {}

const ALIAS_RE = /^\{(.+)\}$/
const ALIAS_REF_RE = /\{([^}]+)\}/g

type Quantity = { value: number; unit?: string }

function isRawToken(value: unknown): value is RawToken {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    ((typeof (value as RawToken).value === 'string' ||
      typeof (value as RawToken).value === 'number') ||
      typeof (value as RawToken).value === 'object')
  )
}

function isDimensionValue(value: TokenValue): value is DimensionValue {
  return typeof value === 'object' && value !== null && 'value' in value && 'unit' in value
}

function parseNumericToken(token: string): Quantity | null {
  const m = token.match(/^(-?\d+(?:\.\d+)?)([a-zA-Z%]+)?$/)
  if (!m) return null
  const value = Number.parseFloat(m[1]!)
  if (Number.isNaN(value)) return null
  return { value, unit: m[2] }
}

function toQuantity(value: TokenValue): Quantity | null {
  if (typeof value === 'number') return { value }
  if (typeof value === 'string') {
    return parseNumericToken(value.trim())
  }
  if (isDimensionValue(value)) {
    return { value: value.value, unit: value.unit }
  }
  return null
}

function fromQuantity(quantity: Quantity): TokenValue {
  if (quantity.unit) {
    return { value: quantity.value, unit: quantity.unit }
  }
  return quantity.value
}

function extractAliasRefs(input: string): string[] {
  const refs: string[] = []
  let match: RegExpExecArray | null
  ALIAS_REF_RE.lastIndex = 0
  while ((match = ALIAS_REF_RE.exec(input)) !== null) {
    refs.push(match[1]!)
  }
  return refs
}

function canonicalAliasRef(ref: string): string {
  return ref.includes('__') ? ref.replaceAll('__', '.') : ref
}

function applyBinaryOp(
  left: Quantity,
  right: Quantity,
  op: '+' | '-' | '*' | '/',
  path: string,
): Effect.Effect<Quantity, ResolveError> {
  const sameUnit = left.unit === right.unit
  const leftUnitless = left.unit === undefined
  const rightUnitless = right.unit === undefined

  switch (op) {
    case '+':
    case '-': {
      if (!sameUnit) {
        return Effect.fail(
          new ResolveError({
            ref: path,
            message: `Unit mismatch in arithmetic: "${left.unit ?? 'number'} ${op} ${right.unit ?? 'number'}"`,
          }),
        )
      }
      return Effect.succeed({
        value: op === '+' ? left.value + right.value : left.value - right.value,
        unit: left.unit,
      })
    }
    case '*': {
      if (!leftUnitless && !rightUnitless) {
        return Effect.fail(
          new ResolveError({
            ref: path,
            message: `Invalid multiplication of two unit values in "${path}"`,
          }),
        )
      }
      if (!leftUnitless) return Effect.succeed({ value: left.value * right.value, unit: left.unit })
      if (!rightUnitless) return Effect.succeed({ value: left.value * right.value, unit: right.unit })
      return Effect.succeed({ value: left.value * right.value })
    }
    case '/': {
      if (right.value === 0) {
        return Effect.fail(
          new ResolveError({ ref: path, message: `Division by zero in "${path}"` }),
        )
      }
      if (!rightUnitless) {
        return Effect.fail(
          new ResolveError({
            ref: path,
            message: `Invalid division by unit value in "${path}"`,
          }),
        )
      }
      return Effect.succeed({
        value: left.value / right.value,
        unit: left.unit,
      })
    }
  }
}

function evaluateArithmeticExpression(
  expression: string,
  resolved: Map<string, TokenValue>,
  tokenKey: string,
): Effect.Effect<TokenValue, ResolveError> {
  return Effect.gen(function* () {
    const refs = extractAliasRefs(expression)
    let normalized = expression

    for (const ref of refs) {
      const canonicalRef = canonicalAliasRef(ref)
      const resolvedValue = resolved.get(canonicalRef)
      if (resolvedValue === undefined) {
        return yield* Effect.fail(
          new ResolveError({
            ref: canonicalRef,
            message: `Alias not resolved: {${ref}} in token ${tokenKey}`,
          }),
        )
      }
      const quantity = toQuantity(resolvedValue)
      if (!quantity) {
        return yield* Effect.fail(
          new ResolveError({
            ref: canonicalRef,
            message: `Cannot use non-numeric token "{${ref}}" in arithmetic for ${tokenKey}`,
          }),
        )
      }
      const literal = `${quantity.value}${quantity.unit ?? ''}`
      normalized = normalized.replaceAll(`{${ref}}`, literal)
    }

    const tokens =
      normalized.match(/-?\d+(?:\.\d+)?[a-zA-Z%]*|[()+\-*/]/g) ?? []
    if (tokens.length === 0 || tokens.join('') !== normalized.replace(/\s+/g, '')) {
      return yield* Effect.fail(
        new ResolveError({
          ref: tokenKey,
          message: `Invalid arithmetic expression: "${expression}"`,
        }),
      )
    }

    const values: Quantity[] = []
    const ops: string[] = []
    const precedence = (op: string) => (op === '+' || op === '-' ? 1 : 2)

    const applyTop = (): Effect.Effect<void, ResolveError> =>
      Effect.gen(function* () {
        const op = ops.pop() as '+' | '-' | '*' | '/' | undefined
        const right = values.pop()
        const left = values.pop()
        if (!op || !right || !left) {
          return yield* Effect.fail(
            new ResolveError({
              ref: tokenKey,
              message: `Malformed arithmetic expression: "${expression}"`,
            }),
          )
        }
        const result = yield* applyBinaryOp(left, right, op, tokenKey)
        values.push(result)
      })

    for (const token of tokens) {
      if (token === '(') {
        ops.push(token)
        continue
      }
      if (token === ')') {
        while (ops.length && ops[ops.length - 1] !== '(') {
          yield* applyTop()
        }
        if (ops.pop() !== '(') {
          return yield* Effect.fail(
            new ResolveError({
              ref: tokenKey,
              message: `Unbalanced parentheses in "${expression}"`,
            }),
          )
        }
        continue
      }
      if (token === '+' || token === '-' || token === '*' || token === '/') {
        while (
          ops.length &&
          ops[ops.length - 1] !== '(' &&
          precedence(ops[ops.length - 1]!) >= precedence(token)
        ) {
          yield* applyTop()
        }
        ops.push(token)
        continue
      }

      const quantity = parseNumericToken(token)
      if (!quantity) {
        return yield* Effect.fail(
          new ResolveError({
            ref: tokenKey,
            message: `Invalid arithmetic token "${token}" in "${expression}"`,
          }),
        )
      }
      values.push(quantity)
    }

    while (ops.length) {
      if (ops[ops.length - 1] === '(') {
        return yield* Effect.fail(
          new ResolveError({
            ref: tokenKey,
            message: `Unbalanced parentheses in "${expression}"`,
          }),
        )
      }
      yield* applyTop()
    }

    if (values.length !== 1) {
      return yield* Effect.fail(
        new ResolveError({
          ref: tokenKey,
          message: `Malformed arithmetic expression: "${expression}"`,
        }),
      )
    }

    return fromQuantity(values[0]!)
  })
}

/** Flatten a token group tree into dot-path → RawToken */
function flatten(
  group: TokenGroup,
  pathParts: string[] = [],
): Map<string, { token: RawToken; rawPath: string[] }> {
  const result = new Map<string, { token: RawToken; rawPath: string[] }>()

  for (const key of Object.keys(group)) {
    const value = group[key]

    if (isRawToken(value)) {
      const effectivePath = [...pathParts, ...key.split('__')]
      const dotted = effectivePath.join('.')
      if (result.has(dotted)) {
        throw new ResolveError({
          ref: dotted,
          message: `Duplicate token path "${dotted}"`,
        })
      }
      result.set(dotted, { token: value, rawPath: effectivePath })
    } else if (typeof value === 'object' && value !== null) {
      const currentPath = [...pathParts, key]
      const nested = flatten(value as TokenGroup, currentPath)
      for (const [k, v] of nested) {
        result.set(k, v)
      }
    }
  }

  return result
}

/**
 * Collect all unique alias references from a token (value + all themes + all breakpoints values).
 * Returns a Set of dot-paths referenced.
 */
function aliasRefs(token: RawToken): Set<string> {
  const refs = new Set<string>()

  if (typeof token.value === 'string') {
    for (const ref of extractAliasRefs(token.value)) refs.add(canonicalAliasRef(ref))
  }

  if (token.themes) {
    for (const themeVal of Object.values(token.themes)) {
      if (typeof themeVal === 'string') {
        for (const ref of extractAliasRefs(themeVal)) refs.add(canonicalAliasRef(ref))
      }
    }
  }

  if (token.breakpoints) {
    for (const bpVal of Object.values(token.breakpoints)) {
      if (typeof bpVal === 'string') {
        for (const ref of extractAliasRefs(bpVal)) refs.add(canonicalAliasRef(ref))
      }
    }
  }

  return refs
}

/** Build a topological order for alias resolution using Kahn's algorithm.
 *  Includes both value and themes alias dependencies. */
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
  raw: TokenValue,
  resolved: Map<string, TokenValue>,
  tokenKey: string,
): Effect.Effect<{ value: TokenValue; aliasOf?: string }, ResolveError> {
  return Effect.gen(function* () {
    if (typeof raw !== 'string') {
      return { value: raw }
    }

    const hasMathOps = /[+\-*/()]/.test(raw)
    const hasAliasRefs = extractAliasRefs(raw).length > 0
    if (hasMathOps && (hasAliasRefs || /^[-\d.(\s]/.test(raw))) {
      const evaluated = yield* evaluateArithmeticExpression(raw, resolved, tokenKey)
      return { value: evaluated }
    }

    const match = String(raw).match(ALIAS_RE)
    if (!match) {
      return { value: raw }
    }

    const ref = match[1]!
    const canonicalRef = canonicalAliasRef(ref)
    if (!resolved.has(canonicalRef)) {
      return yield* Effect.fail(
        new ResolveError({
          ref: canonicalRef,
          message: `Alias not resolved: {${ref}} in token ${tokenKey}`,
        }),
      )
    }

    return { value: resolved.get(canonicalRef)!, aliasOf: canonicalRef }

  })
}

export const resolveAliases = (
  group: TokenGroup,
): Effect.Effect<FlatTokenMap, ResolveError> =>
  Effect.gen(function* () {
    const flatRaw = flatten(group)
    const order = yield* topoSort(flatRaw)

    /** Tracks the concrete resolved value for each token path (used for alias chaining) */
    const resolved = new Map<string, TokenValue>()
    const result: FlatTokenMap = new Map()

    for (const key of order) {
      const entry = flatRaw.get(key)!
      const { token, rawPath } = entry

      // Resolve default value
      const { value, aliasOf } = yield* resolveValue(token.value, resolved, key)
      resolved.set(key, value)

      // Resolve theme values
      let themeValues: Record<string, ThemeValue> | undefined
      if (token.themes) {
        themeValues = {}
        for (const [theme, rawThemeVal] of Object.entries(token.themes)) {
          const { value: tv, aliasOf: tAlias } = yield* resolveValue(
            rawThemeVal,
            resolved,
            `${key}[themes.${theme}]`,
          )
          themeValues[theme] = { value: tv, aliasOf: tAlias }
        }
      }

      // Resolve breakpoint values
      let breakpointValues: Record<string, ThemeValue> | undefined
      if (token.breakpoints) {
        breakpointValues = {}
        for (const [bp, rawBpVal] of Object.entries(token.breakpoints)) {
          const { value: bv, aliasOf: bAlias } = yield* resolveValue(
            rawBpVal,
            resolved,
            `${key}[breakpoints.${bp}]`,
          )
          breakpointValues[bp] = { value: bv, aliasOf: bAlias }
        }
      }

      const resolvedToken: ResolvedToken = {
        path: rawPath.join('-'),
        rawPath,
        value,
        aliasOf,
        type: token.type ?? 'string',
        category: token.category,
        description: token.description,
        themeValues,
        breakpointValues,
      }
      result.set(key, resolvedToken)
    }

    return result
  })
