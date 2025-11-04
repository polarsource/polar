import { useInfiniteEvents } from '@/hooks/queries/events'
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
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { EventCustomer } from './EventCustomer'
import { EventSourceBadge } from './EventSourceBadge'
import { useEventCard, useEventCostBadge, useEventDisplayName } from './utils'

const PAGE_SIZE = 1

export const EventRow = ({
  event,
  organization,
  depth = 0,
}: {
  event: schemas['Event']
  organization: schemas['Organization']
  depth?: number
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
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
      limit: PAGE_SIZE,
    },
    isExpanded && hasChildren && depth < 1,
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

  const eventDisplayName = useEventDisplayName(event.name)
  const eventCard = useEventCard(event)
  const eventCostBadge = useEventCostBadge(event)

  return (
    <Link
      href={`/dashboard/${organization.slug}/events/${event.id}`}
      className={twMerge('group flex flex-col', isExpanded && 'pb-4')}
    >
      <div
        className={twMerge(
          'dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-col rounded-xl border border-gray-200 bg-white font-mono text-sm transition-colors duration-150 hover:bg-gray-50',
          isExpanded && hasChildren && 'rounded-b-none! border-b-4',
          depth > 0 && !isExpanded
            ? 'rounded-t-none! rounded-b-none! group-last:rounded-b-xl!'
            : '',
          depth > 0 && isExpanded ? 'rounded-t-none!' : '',
        )}
      >
        <div className="flex flex-row items-center justify-between p-3 select-none">
          <div className="flex flex-row items-center gap-x-4">
            {depth === 0 ? (
              <div
                className="dark:bg-polar-700 dark:hover:bg-polar-600 flex cursor-pointer flex-row items-center justify-center rounded-sm border border-gray-200 bg-gray-100 p-1 transition-colors duration-150 hover:bg-gray-200 dark:border-white/5"
                onClick={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                  handleToggleExpand()
                }}
              >
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
              <span className="text-xs">{eventDisplayName}</span>
              <EventSourceBadge source={event.source} />
            </div>
            <span className="dark:text-polar-500 text-xs text-gray-500 capitalize">
              {formattedTimestamp}
            </span>
          </div>
          <div className="flex flex-row items-center gap-x-6">
            {eventCostBadge}
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
                    className="text-xxs h-6 w-6 font-sans"
                    name={event.customer?.name ?? event.customer?.email ?? '—'}
                    avatar_url={event.customer?.avatar_url ?? null}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                <div className="flex flex-row items-center gap-x-2 font-sans">
                  <Avatar
                    className="text-xxs h-8 w-8 font-sans"
                    name={event.customer?.name ?? event.customer?.email ?? '—'}
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
          </div>
        </div>
        {isExpanded ? eventCard : null}
        {isExpanded ? <EventCustomer event={event} /> : null}
      </div>
      {isExpanded && hasChildren && (
        <div className="flex flex-col">
          {children.map((child) => (
            <EventRow
              key={child.id}
              event={child}
              organization={organization}
              depth={depth + 1}
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
    </Link>
  )
}
