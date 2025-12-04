import { useInfiniteEvents } from '@/hooks/queries/events'
import { getAnonymousCustomerName } from '@/utils/anonymous-customer'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { AnonymousCustomerAvatar } from '../Customer/AnonymousCustomerAvatar'
import { EventCustomer } from './EventCustomer'
import { EventSourceBadge } from './EventSourceBadge'
import { useEventCard, useEventCostBadge } from './utils'

const PAGE_SIZE = 10

export const EventRow = ({
  event,
  organization,
  expanded = false,
  depth = 0,
  renderChildren = true,
  renderEventLink = true,
}: {
  event: schemas['Event']
  organization: schemas['Organization']
  expanded?: boolean
  depth?: number
  renderChildren?: boolean
  renderEventLink?: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded)
  const hasChildren = event.child_count > 0

  const {
    data: childrenData,
    fetchNextPage,
    hasNextPage,
    isFetching,
  } = useInfiniteEvents(
    organization.id,
    {
      parent_id: event.id,
      depth: 1,
      limit: PAGE_SIZE,
    },
    isExpanded && hasChildren && depth < 1 && renderChildren,
  )

  const children = useMemo(() => {
    if (!childrenData) return []
    return childrenData.pages.flatMap((page) => page.items)
  }, [childrenData])

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const formattedTimestamp = useMemo(
    () =>
      new Date(event.timestamp).toLocaleDateString(
        'en-US',
        isExpanded
          ? {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
            }
          : {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            },
      ),
    [event, isExpanded],
  )

  const eventCard = useEventCard(event)
  const eventCostBadge = useEventCostBadge(event)

  const router = useRouter()

  const handleNavigateToEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      e.preventDefault()
      router.push(
        `/dashboard/${organization.slug}/analytics/events/${event.id}`,
      )
    },
    [organization, event.id, router],
  )

  return (
    <div
      className={twMerge(
        'group flex cursor-pointer flex-col',
        isExpanded && 'mb-4',
      )}
      onClick={depth === 0 ? handleToggleExpand : handleNavigateToEvent}
    >
      <div
        className={twMerge(
          'dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-col rounded-xl border border-gray-200 bg-white font-mono text-sm transition-colors duration-150 hover:bg-gray-50',
          isExpanded &&
            hasChildren &&
            renderChildren &&
            'rounded-b-none! border-b-4',
          depth > 0 && !isExpanded && renderChildren
            ? 'rounded-t-none! rounded-b-none! group-last:rounded-b-xl!'
            : '',
          depth > 0 && isExpanded && renderChildren ? 'rounded-t-none!' : '',
        )}
      >
        <div className="flex flex-row items-center justify-between p-3 select-none">
          <div className="flex flex-row items-center gap-x-4">
            {depth === 0 ? (
              <div className="dark:bg-polar-700 dark:hover:bg-polar-600 flex flex-row items-center justify-center rounded-sm border border-gray-200 bg-gray-100 p-1 transition-colors duration-150 hover:bg-gray-200 dark:border-white/5">
                {isExpanded ? (
                  <KeyboardArrowDownOutlined fontSize="inherit" />
                ) : (
                  <KeyboardArrowRightOutlined fontSize="inherit" />
                )}
              </div>
            ) : (
              <div className="flex w-6 flex-col items-center justify-center">
                <div className="dark:bg-polar-600 size-1.5 rounded-full bg-gray-200" />
              </div>
            )}
            <div className="flex flex-row items-center gap-x-4">
              <span className="text-xs">{event.label}</span>
              <EventSourceBadge source={event.source} />
              {event.child_count > 0 && (
                <span className="dark:text-polar-500 dark:bg-polar-700 text-xxs rounded-md bg-gray-100 px-2 py-1 text-gray-500 capitalize">
                  {event.child_count}{' '}
                  {event.child_count === 1 ? 'child' : 'children'}
                </span>
              )}
            </div>
            <span className="dark:text-polar-500 text-xs text-gray-500 capitalize">
              {formattedTimestamp}
            </span>
          </div>
          <div className="flex flex-row items-center gap-x-6">
            {isExpanded ? null : eventCostBadge}
            {isExpanded ? (
              renderEventLink ? (
                <Link
                  href={`/dashboard/${organization.slug}/analytics/events/${event.id}`}
                  className="flex flex-col"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    wrapperClassNames="gap-x-1"
                    className="text-xxs h-6 rounded-sm px-2 font-mono"
                  >
                    <span className="text-xxs font-mono">View Event</span>
                  </Button>
                </Link>
              ) : null
            ) : event.customer ? (
              <Tooltip>
                <TooltipTrigger>
                  <Link
                    href={`/dashboard/${organization.slug}/customers/${event.customer?.id}?query=${event.customer?.email}`}
                    className="flex items-center gap-x-3"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <Avatar
                      className="text-xxs size-6"
                      name={
                        event.customer?.name ?? event.customer?.email ?? '—'
                      }
                      avatar_url={event.customer?.avatar_url ?? null}
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  <div className="flex flex-row items-center gap-x-2 font-sans">
                    <Avatar
                      className="text-xxs size-8"
                      name={
                        event.customer?.name ?? event.customer?.email ?? '—'
                      }
                      avatar_url={event.customer?.avatar_url ?? null}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs">
                        {event.customer?.name ?? '—'}
                      </span>
                      <span className="dark:text-polar-500 text-xxs font-mono text-gray-500">
                        {event.customer?.email}
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : event.external_customer_id ? (
              <Tooltip>
                <TooltipTrigger>
                  <AnonymousCustomerAvatar
                    externalId={event.external_customer_id}
                    className="size-6"
                  />
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                  <div className="flex flex-row items-center gap-x-2 font-sans">
                    <AnonymousCustomerAvatar
                      className="text-xxs size-8"
                      externalId={event.external_customer_id}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs">
                        {
                          getAnonymousCustomerName(
                            event.external_customer_id,
                          )[0]
                        }
                      </span>
                      <span className="dark:text-polar-500 text-xxs font-mono text-gray-500">
                        {event.external_customer_id}
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {isExpanded ? eventCard : null}
        {isExpanded ? (
          <div className="flex flex-row items-center justify-between gap-x-2 px-3 py-2">
            <EventCustomer event={event} />
            {eventCostBadge}
          </div>
        ) : null}
      </div>
      {isExpanded && hasChildren && renderChildren && (
        <div className="flex flex-col">
          {children.map((child) => (
            <EventRow
              key={child.id}
              event={child}
              organization={organization}
              depth={depth + 1}
              renderEventLink={false}
            />
          ))}
          {hasNextPage && (
            <Button
              className="dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 w-full rounded-none rounded-b-xl! border border-t-0! border-gray-200 bg-gray-50 text-xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                fetchNextPage()
              }}
              loading={isFetching}
              disabled={isFetching}
            >
              Load More
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
