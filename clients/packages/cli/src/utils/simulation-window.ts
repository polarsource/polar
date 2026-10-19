import { Effect, Option } from 'effect'
import { BillingConfigError } from '@/schemas/BillingConfig'
import type { SimulationWindow } from '@/schemas/Simulation'

const DURATION = /^(\d+)([dmy])$/

const invalid = (flag: string, value: string) =>
  new BillingConfigError({
    message: `Invalid --${flag} "${value}"`,
    hint:
      flag === 'since'
        ? 'Use a duration like 30d, 3m or 1y, or a date like 2026-07-19'
        : 'Use a date like 2026-10-19',
  })

const parseDate = (flag: string, value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? Effect.fail(invalid(flag, value))
    : Effect.succeed(date)
}

const before = (until: Date, amount: number, unit: string) => {
  const date = new Date(until)
  if (unit === 'd') date.setUTCDate(date.getUTCDate() - amount)
  if (unit === 'm') date.setUTCMonth(date.getUTCMonth() - amount)
  if (unit === 'y') date.setUTCFullYear(date.getUTCFullYear() - amount)
  return date
}

export const parseWindow = (
  since: Option.Option<string>,
  until: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const end = Option.isSome(until)
      ? yield* parseDate('until', until.value)
      : undefined
    if (Option.isNone(since)) return { until: end?.toISOString() }
    const duration = DURATION.exec(since.value)
    const start = duration
      ? before(end ?? new Date(), Number(duration[1]), duration[2] ?? '')
      : yield* parseDate('since', since.value)
    return { since: start.toISOString(), until: end?.toISOString() }
  })

export const formatWindow = ({ since, until }: SimulationWindow) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(new Date(since), new Date(until))
