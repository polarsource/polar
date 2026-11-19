import { schemas } from '@polar-sh/client'

export type GanttTone = 'neutral' | 'success' | 'warning' | 'danger'
export type GanttPattern = 'trial' | 'paused'

// Fills are drawn in a text color, which is saturated in both themes. The
// background tokens are near-white in light mode and disappear on the surface.
export const TONE_COLOR = {
  neutral: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const satisfies Record<GanttTone, string>

export const TONE_OPACITY: Record<GanttTone, number> = {
  neutral: 0.16,
  success: 0.55,
  warning: 0.55,
  danger: 0.55,
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
  if (!isActive) return 'neutral'
  return isWindingDown ? 'warning' : 'success'
}
