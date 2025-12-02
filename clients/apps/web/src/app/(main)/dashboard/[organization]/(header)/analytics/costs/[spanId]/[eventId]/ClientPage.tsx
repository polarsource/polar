'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEventTypes } from '@/hooks/queries/event_types'
import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { SpansTitle } from '../../SpansTitle'

import type { LucideIcon } from 'lucide-react'

const PAGE_SIZE = 50

interface EventDetailPageProps {
  organization: schemas['Organization']
  eventId: string
}

type EventTreeNode = schemas['Event'] & { childEvents: EventTreeNode[] }

export default function EventDetailPage({
  organization,
  eventId,
}: EventDetailPageProps) {
  const { data: event } = useEvent(organization.id, eventId, {
    aggregate_fields: ['_cost.amount'],
  })
  const searchParams = useSearchParams()

  const {
    data: childrenData,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(organization.id, {
    parent_id: eventId,
    limit: PAGE_SIZE,
    sorting: ['timestamp'],
    depth: 5,
  })

  const { data: eventTypes } = useEventTypes(
    organization.id,
    {
      query: event?.name,
    },
    !!event,
  )

  const eventType = useMemo(() => {
    if (!event || !eventTypes) {
      return null
    }

    return (
      eventTypes.items.find((eventType) => eventType.name === event.name) ||
      null
    )
  }, [event, eventTypes])

  const childEvents = useMemo(() => {
    if (!childrenData) return []
    return childrenData.pages.flatMap((page) => page.items)
  }, [childrenData])

  const eventTree = useMemo(() => {
    if (!event) {
      return null
    }

    const buildTree = (parentId: string): EventTreeNode[] => {
      return childEvents
        .filter((event) => event.parent_id === parentId)
        .map((event) => ({
          ...event,
          childEvents: buildTree(event.id),
        }))
    }

    return {
      ...event,
      childEvents: buildTree(eventId),
    }
  }, [event, childEvents, eventId])

  const expandedEvent = useMemo(() => {
    const expandedEventId = searchParams.get('event')
    if (!expandedEventId || !event) {
      return event
    }

    return childEvents.find(({ id }) => id === expandedEventId) || event
  }, [searchParams, event, childEvents])

  if (!event) {
    return null
  }

  return (
    <DashboardBody
      title={<SpansTitle organization={organization} eventType={eventType} />}
      header={<div className="h-10" />}
      className="flex flex-col gap-y-12"
    >
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between gap-x-4">
          <h3 className="text-3xl font-medium">{event.label}</h3>
          {'_cost' in event.metadata && event.metadata._cost && (
            <h3 className="dark:text-polar-500 font-mono text-4xl text-gray-400">
              {formatSubCentCurrency(
                Number(event.metadata._cost?.amount ?? 0),
                event.metadata._cost?.currency ?? 'usd',
              )}
            </h3>
          )}
        </div>

        <div className="flex flex-row items-start justify-between gap-x-4">
          <div>
            {event.customer ? (
              <div className="flex flex-row items-center gap-3">
                <Avatar
                  className="size-11"
                  name={event.customer.name ?? event.customer.email}
                  avatar_url={event.customer.avatar_url ?? null}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">
                    {event.customer.name ?? event.customer.email}
                  </span>
                  <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                    {event.external_customer_id ?? ''}
                  </span>
                </div>
              </div>
            ) : event.external_customer_id ? (
              <div className="flex flex-row items-center gap-3">
                <AnonymousCustomerAvatar
                  externalId={event.external_customer_id}
                  className="size-11"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">
                    {getAnonymousCustomerName(event.external_customer_id)[0]}
                  </span>
                  <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                    {event.external_customer_id}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <span className="dark:text-polar-500 pt-[3px] text-sm text-gray-500 capitalize">
            {new Date(event.timestamp).toLocaleDateString('en-US', {
              hour: '2-digit',
              minute: 'numeric',
              second: 'numeric',
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-y-3"></div>
      <div className="flex w-full items-start justify-between gap-8">
        <div className="w-96 flex-none">
          <div className="rounded-2xl border p-4">
            {eventTree && eventType && (
              <Tree
                organization={organization}
                event={eventTree}
                rootEvent={event}
                eventType={eventType}
              ></Tree>
            )}
          </div>
        </div>
        <div className="flex-1">
          {expandedEvent && (
            <div className="flex-1">
              {expandedEvent.source === 'user' && (
                <SpanEventDetailsCard event={expandedEvent} />
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardBody>
  )
}

import { AnonymousCustomerAvatar } from '@/components/Customer/AnonymousCustomerAvatar'
import { useMetadata } from '@/components/Events/EventCard/UserEventCard'
import { getAnonymousCustomerName } from '@/utils/anonymousCustomer'
import { BadgeDollarSignIcon, BotIcon, BracesIcon } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

const DataRow = ({
  label,
  value,
}: {
  label: string
  value: string | number
}) => {
  return (
    <div className="flex flex-row items-center gap-x-4">
      <dt className="flex w-32 flex-row items-center gap-x-4">{label}</dt>
      <dd className="dark:text-polar-500 text-gray-500 tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function DataCard({
  Icon,
  title,
  children,
  variant = 'default',
}: {
  Icon: LucideIcon
  title: string
  children: React.ReactNode
  variant?: 'default' | 'muted'
}) {
  return (
    <div
      className={twMerge(
        'dark:border-polar-700 flex flex-col gap-4 rounded-2xl border border-gray-200 px-4 pt-3.5 pb-4 text-sm',
        variant === 'muted' && 'opacity-50',
      )}
    >
      <span className="dark:text-polar-600 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
        <Icon className="mr-1.5 inline-block size-4" />
        {title}
      </span>
      <div>{children}</div>
    </div>
  )
}

export interface LLMInferenceEventCardProps {
  event: schemas['UserEvent']
}

export const SpanEventDetailsCard = ({ event }: LLMInferenceEventCardProps) => {
  const metadataToRender = useMetadata(event)

  const llmMetadata = '_llm' in event.metadata && event.metadata._llm
  const costMetadata = '_cost' in event.metadata && event.metadata._cost

  const hasMetadata = metadataToRender

  return (
    <div className="@container flex flex-col gap-2">
      <DataCard
        Icon={BracesIcon}
        title="Metadata"
        variant={hasMetadata ? 'default' : 'muted'}
      >
        {hasMetadata ? (
          <pre className="font-mono text-xs whitespace-pre-wrap select-text">
            {JSON.stringify(metadataToRender, null, 2)}
          </pre>
        ) : (
          <p className="dark:text-polar-500 text-center text-sm text-gray-500 italic">
            Assign metadata to your events for improved analytics.
          </p>
        )}
      </DataCard>

      {(llmMetadata || costMetadata) && (
        <div className="grid gap-2 @xl:grid-cols-2">
          {costMetadata && (
            <DataCard title="Costs" Icon={BadgeDollarSignIcon}>
              <dl className="flex flex-col gap-y-2">
                <DataRow
                  label="Cost"
                  value={formatSubCentCurrency(
                    Number(costMetadata.amount),
                    costMetadata.currency ?? 'usd',
                  )}
                />
              </dl>
            </DataCard>
          )}

          {llmMetadata && (
            <DataCard title="LLM" Icon={BotIcon}>
              <dl className="flex flex-col gap-y-2">
                <DataRow label="Vendor" value={llmMetadata.vendor} />
                <DataRow label="Model" value={llmMetadata.model} />
                <DataRow
                  label="Input Tokens"
                  value={llmMetadata.input_tokens}
                />
                {typeof llmMetadata.cached_input_tokens === 'number' && (
                  <DataRow
                    label="Cached Input Tokens"
                    value={llmMetadata.cached_input_tokens}
                  />
                )}
                <DataRow
                  label="Output Tokens"
                  value={llmMetadata.output_tokens}
                />
                <DataRow
                  label="Total Tokens"
                  value={llmMetadata.total_tokens}
                />
              </dl>
            </DataCard>
          )}
        </div>
      )}
    </div>
  )
}

function Tree({
  organization,
  event,
  rootEvent,
  parentEvent,
  eventType,
}: {
  organization: schemas['Organization']
  event: EventTreeNode
  rootEvent: schemas['Event']
  parentEvent?: schemas['Event']
  eventType: schemas['EventType']
}) {
  const router = useRouter()

  const isRootEvent = rootEvent?.id === event.id

  const searchParams = useSearchParams()
  const currentEventId = searchParams.get('event')
  const isSelected =
    currentEventId === event.id || (!currentEventId && isRootEvent)

  const formattedTimestamp = useMemo(() => {
    if (parentEvent) {
      const parentDate = new Date(parentEvent.timestamp)
      const eventDate = new Date(event.timestamp)
      const diffMs = eventDate.getTime() - parentDate.getTime()

      const diffSeconds = Math.floor((diffMs / 1000) % 60)
      const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60)
      const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24)
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffSeconds < 1) {
        return 'same time'
      }

      let relativeTime = ''

      if (diffDays > 0) {
        relativeTime += `${diffDays}d `
      }
      if (diffHours > 0 || relativeTime) {
        relativeTime += `${diffHours}h `
      }
      if (diffMinutes > 0 || relativeTime) {
        relativeTime += `${diffMinutes}m `
      }
      relativeTime += `${diffSeconds}s`

      return relativeTime.trim()
    }

    return new Date(event.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [event.timestamp, parentEvent])

  const costDisplay = useMemo(() => {
    if ('_cost' in event.metadata && event.metadata._cost) {
      return formatSubCentCurrency(
        Number(event.metadata._cost?.amount ?? 0),
        event.metadata._cost?.currency ?? 'usd',
      )
    }
    return null
  }, [event.metadata])

  const showEventType = event.label !== event.name

  const handleEventClick = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('event', event.id)
    router.push(`?${params.toString()}`)
  }, [event.id, router, searchParams])

  return (
    <div className={twMerge('flex flex-col gap-y-1 first:-mt-2 last:-mb-2')}>
      <button
        onClick={handleEventClick}
        className={twMerge(
          '-mx-2 flex flex-col gap-y-0.5 rounded-lg px-2.5 pt-1.5 pb-2 text-left',
          isSelected
            ? 'dark:bg-polar-700 bg-gray-100'
            : 'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-50',
        )}
      >
        <div className="flex w-full flex-col gap-y-1">
          {showEventType && (
            <span className="dark:text-polar-500 block text-xs text-gray-500">
              {event.name}
            </span>
          )}
          <span className="dark:text-polar-100 text-sm font-medium text-gray-700">
            {event.label}
          </span>
        </div>
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            {formattedTimestamp}
          </span>
          {costDisplay && (
            <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
              {costDisplay}
            </span>
          )}
        </div>
      </button>

      {event.childEvents.length > 0 && (
        <ul
          className={twMerge(
            'dark:border-polar-700 ml-1 flex flex-col gap-y-0.5 border-l border-gray-100 pt-2.5 pb-2 pl-4',
          )}
        >
          {event.childEvents.map((child) => (
            <Tree
              key={child.id}
              organization={organization}
              event={child}
              rootEvent={rootEvent}
              eventType={eventType}
              parentEvent={event}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
