import Pagination from '@/components/Pagination/Pagination'
import { useEvents } from '@/hooks/queries/events'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { EventCustomer } from './EventCustomer'
import { EventSourceBadge } from './EventSourceBadge'
import { useEventCard, useEventCostBadge, useEventDisplayName } from './utils'

const PAGE_SIZE = 100

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
  const [childrenPage, setChildrenPage] = useState(1)
  const searchParams = useSearchParams()

  const { data: childrenData } = useEvents(
    organization.id,
    {
      parent_id: event.id,
      page: childrenPage,
      limit: PAGE_SIZE,
    },
    isExpanded && event.child_count > 0,
  )

  const hasChildren = event.child_count > 0
  const children = childrenData?.items ?? []

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

  const leftMargin = depth > 0 ? `${depth * 16}px` : '0px'

  return (
    <div
      className="dark:bg-polar-800 dark:border-polar-700 group dark:hover:bg-polar-700 flex flex-col rounded-xl border border-gray-200 bg-white font-mono text-sm transition-colors duration-150 hover:bg-gray-50"
      style={{ marginLeft: leftMargin }}
    >
      <div
        onClick={handleToggleExpand}
        className="flex cursor-pointer flex-row items-center justify-between p-3 select-none"
      >
        <div className="flex flex-row items-center gap-x-4">
          <div className="dark:bg-polar-700 flex flex-row items-center justify-center rounded-sm border border-gray-200 bg-gray-100 p-1 dark:border-white/5">
            {isExpanded ? (
              <KeyboardArrowDownOutlined fontSize="inherit" />
            ) : (
              <KeyboardArrowRightOutlined fontSize="inherit" />
            )}
          </div>
          <div className="flex flex-row items-center gap-x-4">
            <span className="text-xs">{eventDisplayName}</span>
            <EventSourceBadge source={event.source} />
            {hasChildren && (
              <span className="dark:bg-polar-700 dark:text-polar-400 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                children: {event.child_count}
              </span>
            )}
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
                href={`/dashboard/${organization.slug}/customers?customerId=${event.customer?.id}&query=${event.customer?.email}`}
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
                  <span className="text-xs">{event.customer?.name ?? '—'}</span>
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
      {isExpanded && hasChildren && (
        <div className="flex flex-col gap-y-2 px-3 pb-3">
          {children.map((child) => (
            <EventRow
              key={child.id}
              event={child}
              organization={organization}
              depth={depth + 1}
            />
          ))}
          {childrenData && childrenData.pagination.total_count > PAGE_SIZE && (
            <div className="flex justify-end">
              <Pagination
                currentURL={searchParams}
                currentPage={childrenPage}
                totalCount={childrenData.pagination.total_count}
                pageSize={PAGE_SIZE}
                onPageChange={setChildrenPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
