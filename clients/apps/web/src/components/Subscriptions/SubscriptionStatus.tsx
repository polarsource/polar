import { schemas } from '@polar-sh/client'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { CircleX, Clock } from 'lucide-react'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { subscriptionStatusDisplayNames } from './utils'

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
    if (event.getFullYear() != now.getFullYear()) {
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
  const { status, ends_at } = subscription
  const isEnding = useMemo(() => ends_at !== null, [ends_at])

  const color = useMemo(() => {
    if (status === 'active') {
      return isEnding ? 'border-yellow-500' : 'border-emerald-500'
    }
    if (status === 'trialing') {
      return 'border-cyan-500'
    }
    return 'border-red-500'
  }, [status, isEnding])

  const icon = useMemo(() => {
    if (!isEnding) {
      return null
    }
    if (status === 'canceled') {
      return <CircleX className="size-3" />
    }
    return <Clock className="size-3" />
  }, [isEnding, status])

  return (
    <StatusLabel color={color} dt={ends_at} icon={icon}>
      {subscriptionStatusDisplayNames[subscription.status]}
    </StatusLabel>
  )
}
