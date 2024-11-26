'use client'

import { CheckOutlined, CloseOutlined } from '@mui/icons-material'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { DashboardBody } from '../Layout/DashboardLayout'

enum BenefitActivityLogType {
  REVOKED = 'REVOKED',
  GRANTED = 'GRANTED',
  LIFECYCLE = 'LIFECYCLE',
}

enum ActivityEventContextType {
  ORDER = 'ORDER',
  UPGRADE = 'UPGRADE',
  DOWNGRADE = 'DOWNGRADE',
  ENABLE = 'ENABLE',
  DISABLE = 'DISABLE',
  UPDATED = 'UPDATED',
  CREATED = 'CREATED',
  DELETED = 'DELETED',
}

interface ActivityEventBaseContext {
  type: ActivityEventContextType
}

interface ActivityEventOrderContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.ORDER
  product: string
}

interface ActivityEventUpgradeContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.UPGRADE
  fromProduct: string
  toProduct: string
}

interface ActivityEventDowngradeContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.DOWNGRADE
  fromProduct: string
  toProduct: string
}

interface ActivityEventCreatedContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.CREATED
}

interface ActivityEventUpdatedContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.UPDATED
}

interface ActivityEventDeletedContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.DELETED
}

interface ActivityEventEnableContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.ENABLE
  product: string
}

interface ActivityEventDisableContext extends ActivityEventBaseContext {
  type: ActivityEventContextType.DISABLE
  product: string
}

type ActivityEventLifecycleContext =
  | ActivityEventEnableContext
  | ActivityEventDisableContext
  | ActivityEventCreatedContext
  | ActivityEventUpdatedContext
  | ActivityEventDeletedContext

interface ActivityEventBase {
  id: string
  user: {
    name: string
    avatar: string
  }
  createdAt: string
  message: string
}

interface ActivityEventRevoked extends ActivityEventBase {
  type: BenefitActivityLogType.REVOKED
  context:
    | ActivityEventOrderContext
    | ActivityEventUpgradeContext
    | ActivityEventDowngradeContext
}

interface ActivityEventGranted extends ActivityEventBase {
  type: BenefitActivityLogType.GRANTED
  context:
    | ActivityEventOrderContext
    | ActivityEventUpgradeContext
    | ActivityEventDowngradeContext
}

interface ActivityEventLifecycle extends ActivityEventBase {
  type: BenefitActivityLogType.LIFECYCLE
  context: ActivityEventLifecycleContext
}

type ActivityEvent =
  | ActivityEventRevoked
  | ActivityEventGranted
  | ActivityEventLifecycle

export const BenefitActivityLog = () => {
  const { currentUser } = useAuth()

  const events: ActivityEvent[] = [
    {
      id: '1',
      type: BenefitActivityLogType.REVOKED,
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      createdAt: '2025-01-15T08:15:00Z',
      message: 'App Basic License was revoked',
      context: {
        type: ActivityEventContextType.DOWNGRADE,
        fromProduct: 'App Pro Version',
        toProduct: 'App Basic Version',
      },
    },
    {
      id: '2',
      type: BenefitActivityLogType.GRANTED,
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      createdAt: '2025-01-15T08:15:00Z',
      message: 'App Pro License was granted',
      context: {
        type: ActivityEventContextType.ORDER,
        product: 'App Pro Version',
      },
    },
    {
      id: '3',
      type: BenefitActivityLogType.LIFECYCLE,
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      createdAt: '2025-01-15T08:15:00Z',
      message: 'App Pro License was enabled on product App Pro Version',
      context: {
        type: ActivityEventContextType.ENABLE,
        product: 'App Pro Version',
      },
    },
    {
      id: '4',
      type: BenefitActivityLogType.LIFECYCLE,
      user: {
        name: currentUser?.email ?? '',
        avatar: currentUser?.avatar_url ?? '',
      },
      createdAt: '2025-01-15T08:15:00Z',
      message: 'App Pro License was created',
      context: {
        type: ActivityEventContextType.CREATED,
      },
    },
  ]

  const renderOrderEvent = useCallback((event: ActivityEvent) => {
    const { type } = event.context

    switch (type) {
      case ActivityEventContextType.DOWNGRADE:
      case ActivityEventContextType.UPGRADE: {
        const { fromProduct, toProduct } = event.context as
          | ActivityEventUpgradeContext
          | ActivityEventDowngradeContext
        return (
          <div className="dark:text-polar-500 flex items-center gap-x-2 text-xs text-gray-500">
            <span>{fromProduct}</span>
            <svg
              className="dark:text-polar-500 h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            <span>{toProduct}</span>
          </div>
        )
      }
      case ActivityEventContextType.ENABLE:
      case ActivityEventContextType.DISABLE:
      case ActivityEventContextType.ORDER: {
        const { product } = event.context as ActivityEventOrderContext
        return (
          <div className="dark:text-polar-500 flex items-center gap-x-2 text-xs text-gray-500">
            <span>{product}</span>
          </div>
        )
      }
      default:
        return null
    }
  }, [])

  const resolvePill = useCallback((event: ActivityEvent) => {
    let color: 'gray' | 'blue' | 'green' | 'red'
    switch (event.type) {
      case BenefitActivityLogType.REVOKED:
        color = 'red'
        break
      case BenefitActivityLogType.GRANTED:
        color = 'green'
        break
      case BenefitActivityLogType.LIFECYCLE:
        color = 'blue'
        break
      default:
        color = 'gray'
    }

    const contextTypeMap: { [key in ActivityEventContextType]: string } = {
      [ActivityEventContextType.ORDER]: 'Purchase',
      [ActivityEventContextType.DOWNGRADE]: 'Downgrade',
      [ActivityEventContextType.UPGRADE]: 'Upgrade',
      [ActivityEventContextType.ENABLE]: 'Enable',
      [ActivityEventContextType.DISABLE]: 'Disable',
      [ActivityEventContextType.CREATED]: 'Created',
      [ActivityEventContextType.UPDATED]: 'Updated',
      [ActivityEventContextType.DELETED]: 'Deleted',
    }

    return (
      <Pill className="capitalize" color={color}>
        {contextTypeMap[event.context.type]}
      </Pill>
    )
  }, [])

  return (
    <DashboardBody>
      <div className="flex">
        <div className="relative">
          {events.map((event, index) => (
            <div key={event.id} className="relative pb-4">
              {index < events.length - 1 && (
                <div
                  className="dark:border-polar-800 absolute -bottom-8 left-4 top-8 border border-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start gap-x-4 space-x-3">
                <div className="relative pt-5">
                  {event.type === BenefitActivityLogType.REVOKED && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 backdrop-blur-2xl dark:bg-red-900/20">
                      <CloseOutlined className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                  {event.type === BenefitActivityLogType.GRANTED && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 backdrop-blur-2xl dark:bg-green-900/20">
                      <CheckOutlined className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  {event.type === BenefitActivityLogType.LIFECYCLE && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 backdrop-blur-2xl dark:bg-blue-900/20">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </div>
                <div className="dark:bg-polar-800 flex flex-grow flex-col gap-y-4 rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Avatar
                        className="h-8 w-8"
                        avatar_url={event.user.avatar}
                        name={event.user.name}
                      />
                      <span className="dark:text-polar-500 text-sm text-gray-500">
                        {event.user.name}
                      </span>
                    </div>
                    <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                      {new Date(event.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {' · '}
                      {new Date(event.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h3 className="dark:text-polar-100 text-base text-gray-900">
                    {event.message}
                  </h3>
                  <div className="flex items-center justify-between gap-6 font-mono">
                    <div className="flex items-center gap-3 rounded-full p-1 pr-4">
                      {resolvePill(event)}
                      {renderOrderEvent(event)}
                    </div>
                    <Pill color="gray">*****-SJKN23</Pill>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardBody>
  )
}

import { useAuth } from '@/hooks'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

const Pill = ({
  children,
  color,
  className,
}: {
  children: React.ReactNode
  color: 'gray' | 'blue' | 'purple' | 'green' | 'red'
  className?: string
}) => {
  return (
    <span
      className={twMerge(
        'inline-flex items-center space-x-3 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',

        color === 'gray'
          ? 'dark:bg-polar-500/20 dark:text-polar-400 bg-gray-200 text-gray-500'
          : '',
        color === 'blue'
          ? 'bg-blue-100 text-blue-500 dark:bg-blue-500/20 dark:text-blue-500'
          : '',
        color === 'green'
          ? 'bg-green-100 text-green-500 dark:bg-green-500/20 dark:text-green-500  '
          : '',
        color === 'red'
          ? 'bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-500  '
          : '',
        className,
      )}
    >
      {children}
    </span>
  )
}

export default Pill
