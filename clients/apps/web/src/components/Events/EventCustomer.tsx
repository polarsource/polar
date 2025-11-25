import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  BirdIcon,
  BugIcon,
  CatIcon,
  DogIcon,
  FishIcon,
  MouseIcon,
  PandaIcon,
  RabbitIcon,
  ShrimpIcon,
  SnailIcon,
  SquirrelIcon,
  TurtleIcon,
  WormIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

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

const colors = [
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Purple',
  'Orange',
  'Pink',
  'Teal',
  'Coral',
  'Indigo',
  'Amber',
  'Crimson',
] as const

const animals = [
  'Bird',
  'Bug',
  'Cat',
  'Dog',
  'Fish',
  'Panda',
  'Rabbit',
  'Mouse',
  'Shrimp',
  'Snail',
  'Squirrel',
  'Turtle',
  'Worm',
] as const

function getAnonymousCustomerName(
  externalId: string,
): [(typeof colors)[number], (typeof animals)[number]] {
  const sample = btoa(`${externalId.slice(0, 8)}${externalId.slice(-8)}`)

  let hash = 0
  for (let i = 0; i < sample.length; i++) {
    hash = (hash << 5) - hash + sample.charCodeAt(i)
    hash = hash & hash
  }

  const colorIndex = Math.abs(hash) % colors.length
  const animalIndex = Math.abs(hash >> 8) % animals.length

  return [colors[colorIndex], animals[animalIndex]]
}

export const EventCustomer = ({ event }: { event: schemas['Event'] }) => {
  const { organization } = useContext(OrganizationContext)

  if (isAnonymousCustomerEvent(event)) {
    const [color, animal] = getAnonymousCustomerName(event.external_customer_id)

    return (
      <div className="flex flex-row items-center gap-x-2">
        <div className="flex flex-row items-center gap-x-2 font-sans">
          <div
            className={twMerge(
              'flex size-6 items-center justify-center rounded-full ring ring-black/10 ring-inset dark:ring-white/10',
              color === 'Red'
                ? 'bg-red-500/10 text-red-600'
                : color === 'Blue'
                  ? 'bg-blue-500/10 text-blue-600'
                  : color === 'Green'
                    ? 'bg-green-500/10 text-green-600'
                    : color === 'Yellow'
                      ? 'bg-yellow-500/10 text-yellow-600'
                      : color === 'Purple'
                        ? 'bg-purple-500/10 text-purple-600'
                        : color === 'Orange'
                          ? 'bg-orange-500/10 text-orange-600'
                          : color === 'Pink'
                            ? 'bg-pink-500/10 text-pink-600'
                            : color === 'Teal'
                              ? 'bg-teal-500/10 text-teal-600'
                              : color === 'Coral'
                                ? 'bg-rose-500/10 text-rose-600'
                                : color === 'Indigo'
                                  ? 'bg-indigo-500/10 text-indigo-600'
                                  : color === 'Amber'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : color === 'Crimson'
                                      ? 'bg-rose-500/10 text-rose-600'
                                      : '',
            )}
          >
            {animal === 'Bird' ? (
              <BirdIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Bug' ? (
              <BugIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Cat' ? (
              <CatIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Dog' ? (
              <DogIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Fish' ? (
              <FishIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Panda' ? (
              <PandaIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Rabbit' ? (
              <RabbitIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Mouse' ? (
              <MouseIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Shrimp' ? (
              <ShrimpIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Snail' ? (
              <SnailIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Squirrel' ? (
              <SquirrelIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Turtle' ? (
              <TurtleIcon className="size-3.5" strokeWidth={1.5} />
            ) : animal === 'Worm' ? (
              <WormIcon className="size-3.5" strokeWidth={1.5} />
            ) : null}
          </div>
          <div className="flex flex-row items-baseline gap-x-2">
            <span className="dark:text-polar-500 text-sm text-gray-500">
              {color} {animal}
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
