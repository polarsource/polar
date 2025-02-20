import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { useState } from 'react'

const EventRow = ({ event }: { event: schemas['Event'] }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const formattedTimestamp = new Date(event.timestamp).toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    },
  )

  return (
    <ListItem
      className="flex flex-col items-start justify-start gap-y-4 font-mono text-xs"
      onSelect={handleToggleExpand}
    >
      <div className="flex flex-row items-center justify-start gap-x-8">
        <div className="flex w-full max-w-[180px] flex-shrink-0 flex-col items-start">
          <span className="font-mono text-xs capitalize">
            {formattedTimestamp}
          </span>
        </div>
        <div className="flex w-full max-w-[120px] flex-shrink-0 flex-col items-start">
          <span>{event.name}</span>
        </div>
        <div className="flex w-full max-w-[180px] flex-shrink-0 flex-row items-center gap-x-2">
          <Avatar
            className="dark:bg-polar-900 text-xxs h-8 w-8 bg-white"
            name={event.customer?.name ?? event.customer?.email ?? '—'}
            avatar_url={event.customer?.avatar_url ?? null}
          />
          <div className="flex flex-col">
            <span className="text-xs">
              {event.customer
                ? (event.customer.name ?? '—')
                : (event.external_customer_id ?? '—')}
            </span>
            <span className="dark:text-polar-500 text-xxs text-xs text-gray-500">
              {event.customer?.email ?? '—'}
            </span>
          </div>
        </div>
        <div className="flex w-full flex-col items-start">
          <pre className="w-full min-w-0 truncate font-mono text-xs">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      </div>
      {isExpanded && (
        <pre className="dark:bg-polar-800 w-full rounded-md bg-gray-100 p-4 font-mono text-xs">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      )}
    </ListItem>
  )
}

export const Events = ({ events }: { events: schemas['Event'][] }) => {
  return (
    <List className="flex flex-col" size="small">
      <ListItem className="flex flex-row items-center justify-start gap-x-8 font-mono text-xs">
        <div className="flex w-full max-w-[180px] flex-shrink-0 flex-col items-start">
          <span className="font-mono text-xs capitalize">Timestamp</span>
        </div>
        <div className="flex w-full max-w-[120px] flex-shrink-0 flex-col items-start">
          <span className="font-mono text-xs capitalize">Event</span>
        </div>
        <div className="flex w-full max-w-[180px] flex-shrink-0 flex-col items-start">
          <span className="font-mono text-xs capitalize">Customer</span>
        </div>
        <div className="flex w-full max-w-[120px] flex-shrink-0 flex-col items-start">
          <span className="font-mono text-xs capitalize">Metadata</span>
        </div>
      </ListItem>
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </List>
  )
}
