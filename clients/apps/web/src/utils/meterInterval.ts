import { schemas } from '@polar-sh/client'

type RecurringInterval = schemas['RecurringInterval']

// Mirrors `meter_interval_divides_billing_interval` on the backend: the meter cycle has to
// re-align with the billing cycle at every renewal, so the meter interval must divide the
// billing interval cleanly. Day/week are commensurable with each other, month/year with
// each other, but the two families don't convert — only a daily meter interval re-aligns
// on a month/year boundary.
export const meterIntervalDividesBillingInterval = (
  meterInterval: RecurringInterval,
  meterIntervalCount: number,
  billingInterval: RecurringInterval,
  billingIntervalCount: number,
): boolean => {
  const m = meterIntervalCount
  const n = billingIntervalCount

  if (!Number.isInteger(m) || !Number.isInteger(n) || m < 1 || n < 1) {
    return false
  }

  switch (`${meterInterval}:${billingInterval}`) {
    case 'day:day':
    case 'week:week':
    case 'month:month':
    case 'year:year':
      return n % m === 0
    case 'day:week':
      return (n * 7) % m === 0
    case 'day:month':
    case 'day:year':
      return m === 1
    case 'month:year':
      return (n * 12) % m === 0
    default:
      return false
  }
}

// The coarsest meter interval that always divides the given billing interval, used as the
// default when the meter cycle is enabled.
export const defaultMeterInterval = (
  billingInterval: RecurringInterval,
): RecurringInterval =>
  billingInterval === 'month' || billingInterval === 'year' ? 'month' : 'day'
