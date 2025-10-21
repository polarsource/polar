import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { EventCostBadge } from './EventCostBadge'
import { EventSourceBadge } from './EventSourceBadge'

const EventRow = ({
  event,
  organization,
}: {
  event: schemas['Event']
  organization: schemas['Organization']
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

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

  const cost = (event.metadata as schemas['EventMetadataOutput'])._cost

  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-col rounded-xl border border-gray-200 bg-white font-mono text-sm transition-colors duration-75 hover:bg-gray-50">
      <div
        onClick={handleToggleExpand}
        className="flex cursor-pointer select-none flex-row items-center justify-between px-4 py-2"
      >
        <div className="flex flex-row items-center gap-x-8">
          <div className="flex flex-row items-center gap-x-4">
            <span>{event.name}</span>
            <EventSourceBadge source={event.source} />
          </div>
          <span className="dark:text-polar-500 text-sm capitalize text-gray-500">
            {formattedTimestamp}
          </span>
        </div>
        <div className="flex flex-row items-center gap-x-6">
          {cost && (
            <EventCostBadge
              cost={cost?.amount ?? 0}
              currency={cost?.currency ?? 'USD'}
            />
          )}
          <Link
            href={`/dashboard/${organization.slug}/customers?customerId=${event.customer?.id}`}
            className="flex items-center gap-x-3"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <Avatar
              className="dark:bg-polar-900 text-xxs h-8 w-8 bg-white"
              name={event.customer?.name ?? event.customer?.email ?? '—'}
              avatar_url={event.customer?.avatar_url ?? null}
            />
          </Link>
        </div>
      </div>
      {isExpanded && (
        <div className="dark:border-polar-700 border-t border-gray-200 p-2">
          <pre className="dark:bg-polar-800 w-full rounded-md bg-white p-2">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export const Events = ({
  events,
  organization,
}: {
  events: schemas['Event'][]
  organization: schemas['Organization']
}) => {
  return (
    <div className="flex flex-col gap-y-2">
      {events.map((event) => (
        <EventRow key={event.id} event={event} organization={organization} />
      ))}
    </div>
  )
}
