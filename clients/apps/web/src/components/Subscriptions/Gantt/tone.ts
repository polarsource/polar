import { schemas } from '@polar-sh/client'

export type GanttTone = 'neutral' | 'warning' | 'danger'
export type GanttPattern = 'trial' | 'paused'

// Fills are drawn in a text color, which is saturated in both themes. The
// background tokens are near-white in light mode and disappear on the surface.
export const TONE_COLOR = {
  neutral: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
} as const satisfies Record<GanttTone, string>

export const TONE_OPACITY: Record<GanttTone, number> = {
  neutral: 0.16,
  warning: 0.3,
  danger: 0.3,
}

export const getGanttTone = (
  subscription: Pick<
    schemas['Subscription'],
    'status' | 'ended_at' | 'ends_at' | 'pause_at_period_end'
  >,
): GanttTone => {
  if (subscription.ended_at) return 'neutral'
  if (subscription.status === 'past_due') return 'danger'
  const isActive =
    subscription.status === 'active' || subscription.status === 'trialing'
  const isWindingDown =
    subscription.ends_at !== null || subscription.pause_at_period_end
  return isActive && isWindingDown ? 'warning' : 'neutral'
}
