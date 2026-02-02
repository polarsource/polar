import { AnonymousCustomerAvatar } from '@/components/Customer/AnonymousCustomerAvatar'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { getAnonymousCustomerName } from '@/utils/anonymous-customer'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Button from '@spaire/ui/components/atoms/Button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@spaire/ui/components/ui/popover'
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
      <Popover>
        <PopoverTrigger className="group block">
          <div className="flex flex-row items-center gap-x-2 font-sans">
            <AnonymousCustomerAvatar
              externalId={event.external_customer_id}
              className="size-6 shrink-0"
            />
            <div className="flex flex-row items-baseline gap-x-2">
              <span className="dark:text-polar-500 dark:group-data-[state=open]:text-polar-300 text-sm text-gray-500 group-data-[state=open]:text-gray-600">
                {name}
              </span>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="flex w-min flex-col gap-2 overflow-hidden rounded-xl p-2"
          side="top"
          align="center"
          sideOffset={4}
        >
          <div className="flex flex-row items-center gap-x-2 font-sans">
            <AnonymousCustomerAvatar
              externalId={event.external_customer_id}
              className="size-10 shrink-0"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm/4 font-medium whitespace-nowrap text-gray-700 dark:text-white">
                {name}
              </span>
              <span className="dark:text-polar-500 pr-2 font-mono text-xs whitespace-nowrap text-gray-500">
                {event.external_customer_id}
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  if (isIdentifiedCustomerEvent(event)) {
    return (
      <Popover>
        <PopoverTrigger className="group block">
          <div className="flex flex-row items-center gap-x-2 font-sans">
            <div className="flex flex-row items-center gap-x-2 font-sans">
              <Avatar
                className="size-6 shrink-0"
                name={event.customer.name ?? event.customer.email}
                avatar_url={event.customer.avatar_url ?? null}
              />
              <div className="dark:text-polar-200 flex flex-row items-baseline gap-x-2 text-sm whitespace-nowrap text-gray-700">
                {event.customer.name ?? event.customer.email}
              </div>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="flex w-min flex-col gap-2 overflow-hidden rounded-xl p-2"
          side="top"
          align="center"
          sideOffset={4}
        >
          <div className="flex flex-row items-center gap-x-2 font-sans">
            <Avatar
              className="size-10 shrink-0"
              name={event.customer.name ?? event.customer.email}
              avatar_url={event.customer.avatar_url ?? null}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm/4 font-medium whitespace-nowrap text-gray-700 dark:text-white">
                {event.customer.name ?? event.customer.email}
              </span>
              <span className="dark:text-polar-500 pr-2 font-mono text-xs whitespace-nowrap text-gray-500">
                {event.external_customer_id}
              </span>
            </div>
          </div>
          <div className="">
            <Link
              href={`/dashboard/${organization.slug}/customers/${event.customer.id}?query=${event.customer.email}`}
            >
              <Button fullWidth variant="secondary" size="sm">
                View Customer
              </Button>
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return null
}
