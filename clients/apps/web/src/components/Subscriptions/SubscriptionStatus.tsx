import { schemas } from '@polar-sh/client'
import { Pill } from '@polar-sh/orbit'
import { CircleX, Clock } from '@polar-sh/orbit/icons'
import { StatusTooltip } from '@/components/Shared/StatusIcon'
import { SubscriptionStatusIcon } from './SubscriptionStatusIcon'
import {
  getSubscriptionStatusDescription,
  getSubscriptionStatusLabel,
} from './utils'

const formatEventDate = (datetime: string): string => {
  const event = new Date(datetime)
  return event.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(event.getFullYear() === new Date().getFullYear()
      ? {}
      : { year: 'numeric' }),
  })
}

// A scheduled cancellation takes precedence. Otherwise the pause schedule is
// shown: when a paused subscription resumes, or when an active one will pause.
const getEvent = ({
  status,
  ends_at: endsAt,
  resumes_at: resumesAt,
  pause_at_period_end: pausesAtPeriodEnd,
  current_period_end: periodEnd,
}: schemas['Subscription']): { date: string | null; label?: string } => {
  if (endsAt !== null) return { date: endsAt }
  if (status === 'paused') return { date: resumesAt, label: 'Resumes' }
  if (pausesAtPeriodEnd) return { date: periodEnd, label: 'Pauses' }
  return { date: null }
}

export const SubscriptionStatus = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const event = getEvent(subscription)
  const date = event.date ? formatEventDate(event.date) : null

  return (
    <div className="flex flex-row items-center gap-x-2">
      <StatusTooltip
        description={getSubscriptionStatusDescription(subscription)}
      >
        <span className="flex flex-row items-center gap-x-2">
          <SubscriptionStatusIcon subscription={subscription} />
          <span>{getSubscriptionStatusLabel(subscription)}</span>
        </span>
      </StatusTooltip>
      {date && (
        <Pill color="gray">
          {subscription.status === 'canceled' ? (
            <CircleX className="size-3" />
          ) : (
            <Clock className="size-3" />
          )}
          <span>{event.label ? `${event.label} on ${date}` : date}</span>
        </Pill>
      )}
    </div>
  )
}
