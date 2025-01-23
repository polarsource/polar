import { CancelOutlined } from '@mui/icons-material'

import { AccessTimeOutlined } from '@mui/icons-material'

import { Subscription } from '@polar-sh/api'
import Pill from '@polar-sh/ui/components/atoms/Pill'
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
  subscription: Subscription
}) => {
  switch (subscription.status) {
    case 'active':
      if (!subscription.ends_at) {
        return <StatusLabel color="border-emerald-500">Active</StatusLabel>
      }
      return (
        <StatusLabel
          color="border-yellow-500"
          dt={subscription.ends_at}
          icon={<AccessTimeOutlined fontSize="inherit" />}
        >
          Ending
        </StatusLabel>
      )
    case 'canceled':
      return (
        <StatusLabel
          color="border-red-500"
          dt={subscription.ended_at}
          icon={<CancelOutlined fontSize="inherit" />}
        >
          Canceled
        </StatusLabel>
      )
    default:
      return (
        <StatusLabel color="border-red-500">
          {subscriptionStatusDisplayNames[subscription.status]}
        </StatusLabel>
      )
  }
}
