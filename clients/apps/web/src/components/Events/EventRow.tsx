'use client'

import { getAnonymousCustomerName } from '@/utils/anonymous-customer'
import { formatSubCentCurrency } from '@/utils/formatters'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { AnonymousCustomerAvatar } from '../Customer/AnonymousCustomerAvatar'
import { CostDeviationBar } from './CostDeviationBar'
import { EventCustomer } from './EventCustomer'
import { EventSourceBadge } from './EventSourceBadge'
import { useEventCard } from './utils'

export const EventRow = ({
  event,
  organization,
  averageCost,
  p99Cost,
  showSourceBadge = true,
}: {
  event: schemas['Event']
  organization: schemas['Organization']
  averageCost?: number
  p99Cost?: number
  showSourceBadge?: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const eventCard = useEventCard(event)

  // Extract cost metadata
  const costMetadata = useMemo(() => {
    if ('_cost' in event.metadata && event.metadata._cost) {
      const cost = event.metadata._cost as { amount: string; currency: string }
      return {
        cost: Number(cost.amount),
        currency: cost.currency ?? 'usd',
      }
    }
    return null
  }, [event.metadata])

  return (
    <>
      <tr
        className={twMerge(
          'dark:hover:bg-polar-700 cursor-pointer hover:bg-gray-50',
          isExpanded && 'dark:bg-polar-700 bg-gray-50',
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="p-2">
          <div className="flex flex-row items-center gap-x-2">
            <div className="dark:text-polar-500 text-gray-400">
              {isExpanded ? (
                <KeyboardArrowDownOutlined fontSize="small" />
              ) : (
                <KeyboardArrowRightOutlined fontSize="small" />
              )}
            </div>
            <span className="text-sm font-medium">{event.label}</span>
            {showSourceBadge && <EventSourceBadge source={event.source} />}
          </div>
        </td>

        <td className="p-2">
          {event.customer ? (
            <Link
              href={`/dashboard/${organization.slug}/customers/${event.customer.id}?query=${event.customer.email}`}
              className="flex items-center gap-x-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar
                className="text-xxs size-5"
                name={event.customer.name ?? event.customer.email ?? '—'}
                avatar_url={event.customer.avatar_url ?? null}
              />
              <span className="dark:text-polar-400 text-xs text-gray-600">
                {event.customer.name ?? event.customer.email ?? '—'}
              </span>
            </Link>
          ) : event.external_customer_id ? (
            <div className="flex items-center gap-x-2">
              <AnonymousCustomerAvatar
                externalId={event.external_customer_id}
                className="size-5"
              />
              <span className="dark:text-polar-400 text-xs text-gray-600">
                {getAnonymousCustomerName(event.external_customer_id)[0]}
              </span>
            </div>
          ) : (
            <span className="dark:text-polar-500 text-xs text-gray-400">—</span>
          )}
        </td>

        <td className="dark:text-polar-500 p-2 text-sm text-gray-600">
          <FormattedDateTime datetime={event.timestamp} resolution="time" />
        </td>

        <td className="p-2 text-right text-sm tabular-nums">
          {costMetadata ? (
            <div className="flex flex-row items-center justify-end gap-x-3">
              {averageCost !== undefined && p99Cost !== undefined && (
                <CostDeviationBar
                  eventCost={costMetadata.cost}
                  averageCost={averageCost}
                  p99Cost={p99Cost}
                />
              )}
              <span className="font-mono">
                {formatSubCentCurrency(
                  costMetadata.cost,
                  costMetadata.currency,
                )}
              </span>
            </div>
          ) : (
            <span className="dark:text-polar-500 text-gray-400">—</span>
          )}
        </td>
      </tr>

      {/* Expanded content */}
      {isExpanded && (
        <tr className="dark:bg-polar-800 bg-gray-50">
          <td colSpan={4} className="p-0">
            <div className="dark:border-polar-700 border-t border-gray-200 px-4 py-3">
              {eventCard}
              <div className="dark:border-polar-700 mt-3 flex flex-row items-center justify-between border-t border-gray-200 pt-3">
                <EventCustomer event={event} />
                <Link
                  href={`/dashboard/${organization.slug}/analytics/events/${event.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                  >
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
