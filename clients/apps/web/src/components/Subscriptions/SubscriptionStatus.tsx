import { schemas } from '@polar-sh/client'
import { Pill } from '@polar-sh/orbit'
import { CircleX, Clock } from 'lucide-react'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  getSubscriptionStatusBorderColor,
  subscriptionStatusDisplayNames,
} from './utils'

const StatusLabel = ({
  color,
  dt,
  eventLabel,
  icon,
  children,
}: {
  color: string
  dt?: string | null
  eventLabel?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) => {
  let prettyEventDate = null
  if (dt) {
    const event = new Date(dt)
    const now = new Date()
    if (event.getFullYear() !== now.getFullYear()) {
      prettyEventDate = event.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } else {
      prettyEventDate = event.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
      })
    }
  }

  return (
    <div className={`flex flex-row items-center gap-x-2`}>
      <span className={twMerge('h-2 w-2 rounded-full border-2', color)} />
      <span className="capitalize">{children}</span>
      {prettyEventDate && (
        <Pill color="gray">
          {icon}
          <span>
            {eventLabel ? `${eventLabel} ${prettyEventDate}` : prettyEventDate}
          </span>
        </Pill>
      )}
    </div>
  )
}

export const SubscriptionStatus = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const {
    status,
    ends_at,
    pause_at_period_end,
    resumes_at,
    current_period_end,
  } = subscription
  const isEnding = useMemo(() => ends_at !== null, [ends_at])

  const color = useMemo(
    () => getSubscriptionStatusBorderColor(status, isEnding),
    [status, isEnding],
  )

  // A scheduled cancellation takes precedence; otherwise surface the pause
  // schedule — when a paused sub resumes, or when an active sub will pause.
  const { eventDate, eventLabel } = useMemo<{
    eventDate: string | null
    eventLabel?: string
  }>(() => {
    if (isEnding) {
      return { eventDate: ends_at }
    }
    if (status === 'paused') {
      return { eventDate: resumes_at, eventLabel: 'Resumes' }
    }
    if (pause_at_period_end) {
      return { eventDate: current_period_end, eventLabel: 'Pauses' }
    }
    return { eventDate: null }
  }, [
    isEnding,
    ends_at,
    status,
    resumes_at,
    pause_at_period_end,
    current_period_end,
  ])

  const icon = useMemo(() => {
    if (status === 'canceled') {
      return <CircleX className="size-3" />
    }
    if (eventDate) {
      return <Clock className="size-3" />
    }
    return null
  }, [status, eventDate])

  return (
    <StatusLabel
      color={color}
      dt={eventDate}
      eventLabel={eventLabel}
      icon={icon}
    >
      {subscriptionStatusDisplayNames[subscription.status]}
    </StatusLabel>
  )
}
