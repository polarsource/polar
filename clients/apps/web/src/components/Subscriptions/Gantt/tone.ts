import { schemas } from '@polar-sh/client'

export type GanttTone = 'background-inverse' | 'background-warning'

export const TONE_OPACITY: Record<GanttTone, number> = {
  'background-inverse': 0.16,
  'background-warning': 1,
}

export const getGanttTone = (
  subscription: Pick<
    schemas['Subscription'],
    'status' | 'ended_at' | 'ends_at' | 'pause_at_period_end'
  >,
): GanttTone => {
  if (subscription.ended_at) return 'background-inverse'
  const isActive =
    subscription.status === 'active' || subscription.status === 'trialing'
  const isWindingDown =
    subscription.ends_at !== null || subscription.pause_at_period_end
  return subscription.status === 'past_due' || (isActive && isWindingDown)
    ? 'background-warning'
    : 'background-inverse'
}
