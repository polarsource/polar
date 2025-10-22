import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BenefitEventCard } from './EventCard/BenefitEventCard'
import { UserEventCard } from './EventCard/UserEventCard'
import { EventCostBadge } from './EventCostBadge'
import { EventSourceBadge } from './EventSourceBadge'

type Event = schemas['Event']

const EventRow = ({
  event,
  organization,
}: {
  event: Event
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

  const eventCard = useMemo(() => {
    switch (event.source) {
      case 'system':
        switch (event.name) {
          case 'benefit.granted':
          case 'benefit.cycled':
          case 'benefit.updated':
          case 'benefit.revoked':
            return <BenefitEventCard event={event} />
          default:
            return <UserEventCard event={event} />
        }
      default:
        return <UserEventCard event={event} />
    }
  }, [event])

  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 group dark:hover:bg-polar-700 flex flex-col rounded-xl border border-gray-200 bg-white font-mono text-sm transition-colors duration-150 hover:bg-gray-50">
      <div
        onClick={handleToggleExpand}
        className="flex cursor-pointer flex-row items-center justify-between px-4 py-2 select-none"
      >
        <div className="flex flex-row items-center gap-x-8">
          <div className="flex flex-row items-center gap-x-4">
            <span>{event.name}</span>
            <EventSourceBadge source={event.source} />
          </div>
          <span className="dark:text-polar-500 text-sm text-gray-500 capitalize">
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
                  className="dark:bg-polar-900 text-xxs h-8 w-8 bg-white"
                  name={event.customer?.name ?? event.customer?.email ?? '—'}
                  avatar_url={event.customer?.avatar_url ?? null}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" align="end">
              <div className="flex flex-row items-center gap-x-2 font-sans">
                <Avatar
                  className="dark:bg-polar-900 text-xxs h-8 w-8 bg-white"
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
