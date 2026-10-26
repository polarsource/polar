import { type Rule, type RuleId, RULES } from '@/linters/rules'

export interface Observation {
  readonly rule: RuleId
  readonly root: string
  readonly stack: string
}

export interface Recording<T> {
  readonly value: T | undefined
  readonly failure: unknown
  readonly observations: ReadonlyArray<Observation>
}

export class BlockedError extends Error {
  readonly rule: RuleId

  constructor(rule: RuleId) {
    super(`${RULES[rule].message} while the config was being evaluated`)
    this.rule = rule
  }
}

const property = (object: unknown, name: string): unknown =>
  (typeof object === 'object' && object !== null) ||
  typeof object === 'function'
    ? (object as Record<string, unknown>)[name]
    : undefined

const locate = (path: string) => {
  const keys = path.split('.')
  const key = keys.pop() ?? ''
  const parent = keys.reduce<unknown>(property, globalThis)
  return parent === undefined || parent === null
    ? undefined
    : { parent: parent as Record<string, unknown>, key }
}

const install = (
  id: RuleId,
  rule: Rule,
  root: string,
  observations: Observation[],
): (() => void) | undefined => {
  const withoutArguments = root.endsWith('()')
  const path = withoutArguments ? root.slice(0, -2) : root
  const target = locate(path)
  if (target === undefined) return undefined
  const { parent, key } = target
  const original = parent[key]
  if (original === undefined || original === null) return undefined

  const note = () => {
    observations.push({ rule: id, root, stack: new Error().stack ?? '' })
    if (rule.block) throw new BlockedError(id)
  }

  const replacement =
    typeof original === 'function'
      ? new Proxy(original, {
          apply: (fn, self, args) => {
            if (!withoutArguments || args.length === 0) note()
            return Reflect.apply(fn, self, args)
          },
          construct: (fn, args, newTarget) => {
            if (!withoutArguments || args.length === 0) note()
            return Reflect.construct(fn, args, newTarget)
          },
        })
      : new Proxy(original as object, {
          get: (object, property, receiver) => {
            if (typeof property === 'string') note()
            return Reflect.get(object, property, receiver)
          },
        })

  parent[key] = replacement
  return () => {
    parent[key] = original
  }
}

export const record = async <T>(
  run: () => Promise<T>,
): Promise<Recording<T>> => {
  const observations: Observation[] = []
  const restore = (Object.entries(RULES) as [RuleId, Rule][]).flatMap(
    ([id, rule]) =>
      rule.roots.flatMap((root) => install(id, rule, root, observations) ?? []),
  )
  try {
    return { value: await run(), failure: undefined, observations }
  } catch (failure) {
    return { value: undefined, failure, observations }
  } finally {
    restore.reverse().forEach((undo) => undo())
  }
}
