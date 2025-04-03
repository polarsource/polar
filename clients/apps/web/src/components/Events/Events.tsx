import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { List } from '@polar-sh/ui/components/atoms/List'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const EventRow = ({ event }: { event: schemas['Event'] }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const { organization } = useContext(MaintainerOrganizationContext)

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
    <>
      <tr
        onClick={handleToggleExpand}
        className={twMerge(
          'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-50',
          isExpanded && 'dark:bg-polar-800 bg-gray-50',
        )}
      >
        <td className="px-4 py-2">
          <div className="flex w-[180px] flex-shrink-0">
            <span className="font-mono text-xs capitalize">
              {formattedTimestamp}
            </span>
          </div>
        </td>
        <td className="px-4 py-2">
          <div className="w-[120px] flex-shrink-0 font-mono text-sm">
            <span>{event.name}</span>
          </div>
        </td>
        <td className="px-4 py-2">
          <Link
            href={`/dashboard/${organization.slug}/customers?customerId=${event.customer?.id}`}
            className="flex w-[180px] flex-shrink-0 items-center gap-x-3"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
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
              <span className="dark:text-polar-500 text-xxs text-gray-500">
                {event.customer?.email ?? '—'}
              </span>
            </div>
          </Link>
        </td>
        <td className="px-4 py-2">
          <pre className="w-full min-w-0 truncate font-mono text-xs">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td className="px-2 pb-2" colSpan={4}>
            <pre className="dark:bg-polar-800 mt-2 w-full rounded-md bg-gray-100 p-4 font-mono text-xs">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

export const Events = ({ events }: { events: schemas['Event'][] }) => {
  return (
    <List className="flex flex-col" size="small">
      <table className="w-full">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left">
              <span className="font-mono text-xs capitalize">Timestamp</span>
            </th>
            <th className="px-4 py-2 text-left">
              <span className="font-mono text-xs capitalize">Event</span>
            </th>
            <th className="px-4 py-2 text-left">
              <span className="font-mono text-xs capitalize">Customer</span>
            </th>
            <th className="px-4 py-2 text-left">
              <span className="font-mono text-xs capitalize">Metadata</span>
            </th>
          </tr>
        </thead>
        <tbody className="">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </tbody>
      </table>
    </List>
  )
}
