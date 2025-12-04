import { AnonymousCustomerAvatar } from '@/components/Customer/AnonymousCustomerAvatar'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { getAnonymousCustomerName } from '@/utils/anonymous-customer'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'
import { useContext } from 'react'

type AnonymousCustomerEvent = schemas['Event'] & {
  customer: null
  external_customer_id: string
}

type IdentifiedCustomerEvent = schemas['Event'] & {
  customer: schemas['Customer']
  external_customer_id?: string
}

const isAnonymousCustomerEvent = (
  event: schemas['Event'],
): event is AnonymousCustomerEvent => {
  return !event.customer && !!event.external_customer_id
}

const isIdentifiedCustomerEvent = (
  event: schemas['Event'],
): event is IdentifiedCustomerEvent => {
  return !!event.customer
}

export const EventCustomer = ({ event }: { event: schemas['Event'] }) => {
  const { organization } = useContext(OrganizationContext)

  if (isAnonymousCustomerEvent(event)) {
    const [name] = getAnonymousCustomerName(event.external_customer_id)

    return (
      <div className="flex flex-row items-center gap-x-2">
        <div className="flex flex-row items-center gap-x-2 font-sans">
          <AnonymousCustomerAvatar
            externalId={event.external_customer_id}
            className="size-6 shrink-0"
          />
          <div className="flex flex-row items-baseline gap-x-2">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              {name}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (isIdentifiedCustomerEvent(event)) {
    return (
      <Link
        href={`/dashboard/${organization.slug}/customers/${event.customer.id}?query=${event.customer.email}`}
        className="flex flex-row items-center gap-x-2"
      >
        <div className="flex flex-row items-center gap-x-2 font-sans">
          <Avatar
            className="size-6"
            name={event.customer.name ?? event.customer.email}
            avatar_url={event.customer.avatar_url ?? null}
          />
          <div className="dark:text-polar-200 flex flex-row items-baseline gap-x-2 text-sm whitespace-nowrap text-gray-700">
            {event.customer.name ?? event.customer.email}
          </div>
        </div>
      </Link>
    )
  }

  return null
}
