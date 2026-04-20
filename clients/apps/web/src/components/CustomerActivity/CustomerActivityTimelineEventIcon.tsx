import {
  resolveEventDisplay,
  type EventTone,
  type TimelineEventContext,
} from './event-config'

const TONE_CLASSES: Record<EventTone, { icon: string; background: string }> = {
  positive: {
    icon: 'text-emerald-600 dark:text-emerald-300',
    background: 'bg-emerald-100 dark:bg-emerald-950/50',
  },
  warning: {
    icon: 'text-amber-600 dark:text-amber-300',
    background: 'bg-amber-100 dark:bg-amber-950/50',
  },
  danger: {
    icon: 'text-rose-600 dark:text-rose-300',
    background: 'bg-rose-100 dark:bg-rose-950/50',
  },
  neutral: {
    icon: 'text-gray-600 dark:text-polar-200',
    background: 'bg-gray-100 dark:bg-polar-800',
  },
}

export function CustomerActivityTimelineEventIcon({
  event,
}: {
  event: TimelineEventContext
}) {
  const { icon: Icon, tone } = resolveEventDisplay(event, {})
  const classes = TONE_CLASSES[tone]

  return (
    <span
      className={`dark:ring-polar-900 inline-flex size-6 items-center justify-center rounded-full ring-1 ring-white ${classes.background}`}
    >
      <Icon fontSize="inherit" className={`text-sm ${classes.icon}`} />
    </span>
  )
}
