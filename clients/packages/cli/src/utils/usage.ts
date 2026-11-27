import { Context, Effect } from 'effect'

export type UsageValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<string>

export type UsageDetails = Readonly<Record<string, UsageValue>>

export const Usage = Context.Reference<Record<string, UsageValue>>(
  'polar/Usage',
  { defaultValue: () => ({}) },
)

export const HiddenNames = Context.Reference<Set<string>>(
  'polar/Usage/HiddenNames',
  { defaultValue: () => new Set() },
)

export const describeUsage = (details: UsageDetails) =>
  Effect.gen(function* () {
    Object.assign(yield* Usage, details)
  })

export const hideName = (name: string) =>
  Effect.gen(function* () {
    ;(yield* HiddenNames).add(name)
  })
