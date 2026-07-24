import { schemas } from '@polar-sh/client'

/**
 * The merchant dashboard and the customer portal read the same subscription
 * lifecycle from two different schemas. Everything here derives from fields
 * present on both, so a rule is written once and both surfaces agree.
 */
export type AnySubscription =
  | schemas['Subscription']
  | schemas['CustomerSubscription']

export type PauseAction = 'pause' | 'resume' | 'cancel_scheduled_pause'

export const getPauseAction = (
  subscription: AnySubscription,
): PauseAction | null => {
  if (subscription.ended_at) {
    return null
  }
  if (subscription.status === 'paused') {
    return 'resume'
  }
  if (subscription.cancel_at_period_end) {
    return null
  }
  if (subscription.pause_at_period_end) {
    return 'cancel_scheduled_pause'
  }
  if (subscription.status === 'active') {
    return 'pause'
  }
  return null
}

export interface ChargePreviewMeta {
  /** Whether a charge is coming at all. Callers still gate on having something
   *  billable — a free product with no meters has no next invoice. */
  visible: boolean
  chargeDate: string | null
  title: string
  dateLabel: string
  isCancelingAtPeriodEnd: boolean
}

export const getChargePreviewMeta = (
  subscription: AnySubscription,
): ChargePreviewMeta => {
  const isTrialing = subscription.status === 'trialing'
  const isActive = subscription.status === 'active'
  const isPaused = subscription.status === 'paused'

  const isCancelingAtPeriodEnd = Boolean(
    subscription.cancel_at_period_end && !subscription.ended_at,
  )
  const isPausing = Boolean(subscription.pause_at_period_end || isPaused)
  const isResumingCharge =
    isPausing && subscription.resumes_at !== null && !isCancelingAtPeriodEnd
  const isPausingIndefinitely = isPausing && !subscription.resumes_at

  const visible =
    (isActive || isTrialing || isResumingCharge) && !isPausingIndefinitely

  const chargeDate = isTrialing
    ? subscription.trial_end
    : isResumingCharge
      ? subscription.resumes_at
      : subscription.current_period_end

  let title = 'Upcoming charge'
  let dateLabel = 'Next invoice'
  if (isTrialing) {
    title = 'First charge after trial'
    dateLabel = 'Trial ends'
  } else if (isCancelingAtPeriodEnd) {
    title = 'Final charge'
    dateLabel = 'Subscription ends'
  } else if (isResumingCharge) {
    title = 'Charge on resume'
    dateLabel = 'Resumes'
  }

  return { visible, chargeDate, title, dateLabel, isCancelingAtPeriodEnd }
}

export interface SubscriptionScheduleRow {
  key: string
  label: string
  /** Null when the row has no date to show, e.g. an open-ended pause. */
  datetime: string | null
  fallback?: string
}

/**
 * The dated lifecycle rows, in display order. Excludes "Started": the two
 * schemas disagree on which field means it, so each surface supplies its own.
 */
export const getScheduleRows = (
  subscription: AnySubscription,
): SubscriptionScheduleRow[] => {
  const rows: SubscriptionScheduleRow[] = []

  if (subscription.status === 'trialing' && subscription.trial_end) {
    rows.push({
      key: 'trial_end',
      label: 'Trial ends',
      datetime: subscription.trial_end,
    })
  }

  const nextEvent = subscription.ended_at
    ? null
    : (subscription.ends_at ??
      (subscription.status !== 'paused'
        ? subscription.current_period_end
        : null))

  // While trialing, `trial_end` and `current_period_end` hold the same date, so
  // a renewal row would repeat the trial row under a different label.
  const repeatsTrialEnd = rows.some((row) => row.datetime === nextEvent)

  if (nextEvent && !repeatsTrialEnd) {
    rows.push({
      key: 'next_event',
      label: subscription.ends_at
        ? 'Ending date'
        : subscription.pause_at_period_end
          ? 'Pauses on'
          : 'Renewal date',
      datetime: nextEvent,
    })
  }

  if (subscription.status === 'paused' && subscription.paused_at) {
    rows.push({
      key: 'paused_at',
      label: 'Paused on',
      datetime: subscription.paused_at,
    })
  }

  if (subscription.status === 'paused' || subscription.pause_at_period_end) {
    rows.push({
      key: 'resumes_at',
      label: 'Resumes on',
      datetime: subscription.resumes_at,
      fallback: 'Until resumed',
    })
  }

  if (subscription.ended_at) {
    rows.push({
      key: 'ended_at',
      label: 'Ended',
      datetime: subscription.ended_at,
    })
  }

  return rows
}
