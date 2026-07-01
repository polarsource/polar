import { schemas } from '@polar-sh/client'
import { Pill } from '@polar-sh/orbit'
import { CircleX, Clock, Pause } from 'lucide-react'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  getSubscriptionStatusBorderColor,
  subscriptionStatusDisplayNames,
} from './utils'

const StatusLabel = ({
  color,
  dt,
  icon,
  children,
}: {
  color: string
  dt?: string | null
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
          <span>{prettyEventDate}</span>
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
  const { status, ends_at, pause_at_period_end, current_period_end } =
    subscription
  const isEnding = useMemo(() => ends_at !== null, [ends_at])
  const isPausing = useMemo(
    () => pause_at_period_end === true,
    [pause_at_period_end],
  )

  const color = useMemo(
    () => getSubscriptionStatusBorderColor(status, isEnding || isPausing),
    [status, isEnding, isPausing],
  )

  const icon = useMemo(() => {
    if (isPausing && !isEnding) {
      return <Pause className="size-3" />
    }
    if (!isEnding) {
      return null
    }
    if (status === 'canceled') {
      return <CircleX className="size-3" />
    }
    return <Clock className="size-3" />
  }, [isEnding, isPausing, status])

  const eventDate = useMemo(() => {
    if (isEnding) {
      return ends_at
    }
    if (isPausing) {
      return current_period_end
    }
    return null
  }, [isEnding, isPausing, ends_at, current_period_end])

  return (
    <StatusLabel color={color} dt={eventDate} icon={icon}>
      {subscriptionStatusDisplayNames[subscription.status]}
    </StatusLabel>
  )
}
