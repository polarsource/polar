type SubscriptionChargeTiming = {
  status: string
  current_period_end: string | null
  current_meter_period_end: string | null
  meters: readonly unknown[]
}

// Mirrors `_usage_billed_on_meter_cycle`: usage is its own invoice when the meter
// period ends before the subscription period. Paused subscriptions bill that usage
// on resume instead.
export const isUsageBilledOnMeterCycle = (
  subscription: SubscriptionChargeTiming,
): boolean => {
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return false
  }
  if (subscription.meters.length === 0) {
    return false
  }
  const meterEnd = subscription.current_meter_period_end
  const periodEnd = subscription.current_period_end
  if (meterEnd == null || periodEnd == null) {
    return false
  }
  return new Date(meterEnd).getTime() < new Date(periodEnd).getTime()
}

export const formatChargeDate = (date: string | null | undefined): string =>
  date
    ? new Date(date).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : 'N/A'

export const usageChargeCarriedForward = (preview: {
  total_amount: number
  applied_balance_amount: number
  due_amount: number
}): boolean =>
  preview.due_amount === 0 &&
  preview.total_amount + preview.applied_balance_amount > 0
