import { AccessTimeOutlined, CancelOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Pill from '@polar-sh/ui/components/atoms/Pill'
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
        <Pill color="gray" className="flex flex-row">
          {icon}
          <span className="!ml-1">{prettyEventDate}</span>
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
  const trial_ends_at = 'trial_ends_at' in subscription ? subscription.trial_ends_at as string | undefined : undefined
  const isEnding = useMemo(() => ends_at !== null, [ends_at])
  const isTrialing = useMemo(() => status === 'trialing', [status])

  const color = useMemo(() => {
    if (status === 'trialing') {
      return 'border-blue-500'
    }
    if (status === 'active') {
      return isEnding ? 'border-yellow-500' : 'border-emerald-500'
    }
    return 'border-red-500'
  }, [status, isEnding])

  const icon = useMemo(() => {
    if (isTrialing && trial_ends_at) {
      return <AccessTimeOutlined fontSize="inherit" />
    }
    if (!isEnding) {
      return null
    }
    if (status === 'canceled') {
      return <CancelOutlined fontSize="inherit" />
    }
    return <AccessTimeOutlined fontSize="inherit" />
  }, [isTrialing, trial_ends_at, isEnding, status])

  const dateToShow = useMemo(() => {
    if (isTrialing && trial_ends_at) {
      return trial_ends_at
    }
    return ends_at
  }, [isTrialing, trial_ends_at, ends_at])

  return (
    <StatusLabel color={color} dt={dateToShow} icon={icon}>
      {subscriptionStatusDisplayNames[subscription.status]}
    </StatusLabel>
  )
}
