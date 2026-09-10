import { Effect } from 'effect'
import { TriggerError } from '@/services/trigger'

type Override = readonly [path: string, value: unknown]

const parseValue = (raw: string): unknown => {
  if (raw === 'null') return null
  if (!/^[[{"]/.test(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export const parseOverride = (
  input: string,
): Effect.Effect<Override, TriggerError> => {
  const separator = input.indexOf('=')
  if (separator <= 0) {
    return Effect.fail(
      new TriggerError({
        message: `Invalid override "${input}"`,
        hint: 'Use the form path=value, e.g. --override data.customer.email=jane@example.com',
      }),
    )
  }
  return Effect.succeed([
    input.slice(0, separator),
    parseValue(input.slice(separator + 1)),
  ] as const)
}

export const parseOverrides = (inputs: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const entries = yield* Effect.forEach(inputs, parseOverride)
    const seen = new Set<string>()
    for (const [path] of entries) {
      if (seen.has(path)) {
        return yield* new TriggerError({
          message: `Override "${path}" was given more than once`,
        })
      }
      seen.add(path)
    }
    return Object.fromEntries(entries)
  })

export const describeRejection = (detail: unknown) => {
  if (!Array.isArray(detail)) return String(detail)
  return detail
    .map((error: { loc?: unknown[]; msg?: string }) => {
      const location = (error.loc ?? [])
        .filter((segment) => segment !== 'body' && segment !== 'overrides')
        .join('.')
      return location ? `${location}: ${error.msg}` : String(error.msg)
    })
    .join('\n    ')
}
