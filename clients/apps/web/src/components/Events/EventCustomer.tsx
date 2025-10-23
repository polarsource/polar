import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'
import { useContext } from 'react'

export const EventCustomer = ({ event }: { event: schemas['Event'] }) => {
  const { organization } = useContext(OrganizationContext)

  return (
    <Link
      href={`/dashboard/${organization.slug}/customers?customerId=${event.customer?.id}&query=${event.customer?.email}`}
      className="flex flex-row items-center gap-x-2 px-3 py-2"
    >
      <div className="flex flex-row items-center gap-x-2 font-sans">
        <Avatar
          className="dark:bg-polar-900 text-xxs h-6 w-6 bg-white font-sans"
          name={event.customer?.name ?? event.customer?.email ?? '—'}
          avatar_url={event.customer?.avatar_url ?? null}
        />
        <div className="flex flex-row items-baseline gap-x-2">
          {event.customer?.name ? (
            <span className="text-xs">{event.customer?.name}</span>
          ) : null}
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            {event.customer?.email}
          </span>
        </div>
      </div>
    </Link>
  )
}
