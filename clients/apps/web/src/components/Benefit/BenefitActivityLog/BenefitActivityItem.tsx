import { twMerge } from 'tailwind-merge'
import {
  ActivityEvent,
  ActivityEventContextType,
  ActivityEventDowngradeContext,
  ActivityEventOrderContext,
  ActivityEventUpgradeContext,
  BenefitActivityLogType,
} from './BenefitActivityLog.types'

import { CheckOutlined, CloseOutlined } from '@mui/icons-material'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { useCallback } from 'react'

export const BenefitActivityItem = ({
  event,
  index,
  eventsLength,
  expanded,
  onToggle,
}: {
  event: ActivityEvent
  index: number
  eventsLength: number
  expanded: boolean
  onToggle: (event: ActivityEvent, expanded: boolean) => void
}) => {
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
      case ActivityEventContextType.ENABLED:
      case ActivityEventContextType.DISABLED:
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
      [ActivityEventContextType.ENABLED]: 'Enabled',
      [ActivityEventContextType.DISABLED]: 'Disabled',
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
    <div key={event.id} className="relative pb-2">
      {index < eventsLength - 1 && (
        <div
          className="dark:border-polar-800 absolute -bottom-8 left-4 top-8 border border-gray-200"
          aria-hidden="true"
        />
      )}
      <div className="relative flex items-start gap-x-4 space-x-3">
        <div className="relative pt-3">
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
        <div
          className={twMerge(
            'dark:bg-polar-800 dark:hover:bg-polar-700 flex flex-grow cursor-pointer flex-col gap-y-3 rounded-2xl bg-white p-3 shadow-sm hover:bg-gray-100',
          )}
          onClick={() => onToggle(event, !expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar
                className="h-8 w-8"
                avatar_url={event.user.avatar}
                name={event.user.name}
              />
              {expanded ? (
                <span className="dark:text-polar-500 text-sm text-gray-500">
                  {event.user.name}
                </span>
              ) : (
                <span className="dark:text-polar-100 text-sm text-gray-900">
                  {event.message}
                </span>
              )}
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
          {expanded && (
            <>
              <h3 className="dark:text-polar-50 text-base text-gray-900">
                {event.message}
              </h3>
              <div className="flex items-center justify-between gap-6 font-mono">
                <div className="flex items-center gap-3 rounded-full p-1 pr-4">
                  {resolvePill(event)}
                  {renderOrderEvent(event)}
                </div>
                <Pill color="gray">*****-SJKN23</Pill>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

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
