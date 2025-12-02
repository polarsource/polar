'use client'

import { TreeView } from '@/components/Events/TreeView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEventTypes } from '@/hooks/queries/event_types'
import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { SpansTitle } from '../../SpansTitle'

const PAGE_SIZE = 50

interface EventDetailPageProps {
  organization: schemas['Organization']
  eventId: string
}

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
    hierarchical: true,
  })

  const { data: eventTypes } = useEventTypes(organization.id)

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

  const expandedEvent = useMemo(() => {
    const expandedEventId = searchParams.get('event')
    if (!expandedEventId || !event) {
      return event
    }

    const findEventById = (
      events: schemas['Event'][],
    ): schemas['Event'] | undefined => {
      for (const e of events) {
        if (e.id === expandedEventId) {
          return e
        }
        if (e.children && e.children.length > 0) {
          const found = findEventById(e.children)
          if (found) return found
        }
      }
      return undefined
    }

    return findEventById(childEvents) || event
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
          {childEvents.length > 0 && (
            <TreeView
              rootEvent={event}
              childEvents={childEvents}
              organization={organization}
            />
          )}
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
import { EventCardBase } from '@/components/Events/EventCard/EventCardBase'
import { useMetadata } from '@/components/Events/EventCard/UserEventCard'
import { getAnonymousCustomerName } from '@/utils/anonymousCustomer'
import { BadgeDollarSignIcon, BotIcon, BracesIcon } from 'lucide-react'

const DataRow = ({
  label,
  value,
}: {
  label: string
  value: string | number
}) => {
  return (
    <div className="flex flex-row items-center gap-x-4">
      <div className="flex w-48 flex-row items-center gap-x-4">
        <span>{label}</span>
      </div>
      <span className="dark:text-polar-500 text-gray-500">{value}</span>
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

  return (
    <div>
      <EventCardBase className="font-base flex flex-col gap-y-2 p-4 text-sm">
        <span className="-mt-0.5 mb-1 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
          <BracesIcon className="mr-1.5 inline-block size-4" />
          Metadata
        </span>

        <pre className="font-mono text-xs whitespace-pre-wrap select-text">
          {JSON.stringify(metadataToRender, null, 2)}
        </pre>
      </EventCardBase>

      {llmMetadata && (
        <EventCardBase className="font-base flex flex-col gap-y-2 p-4 text-sm">
          <span className="-mt-0.5 mb-1 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
            <BotIcon className="mr-1.5 inline-block size-4" />
            LLM
          </span>

          <DataRow label="Vendor" value={llmMetadata.vendor} />
          <DataRow label="Model" value={llmMetadata.model} />
          <DataRow label="Input Tokens" value={llmMetadata.input_tokens} />
          {typeof llmMetadata.cached_input_tokens === 'number' && (
            <DataRow
              label="Cached Input Tokens"
              value={llmMetadata.cached_input_tokens}
            />
          )}
          <DataRow label="Output Tokens" value={llmMetadata.output_tokens} />
          <DataRow label="Total Tokens" value={llmMetadata.total_tokens} />
        </EventCardBase>
      )}
      {costMetadata && (
        <EventCardBase className="font-base flex flex-col gap-y-2 p-4 text-sm">
          <span className="-mt-0.5 mb-1 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
            <BadgeDollarSignIcon className="mr-1.5 inline-block size-4" />
            Cost
          </span>
          <DataRow
            label="Cost"
            value={formatSubCentCurrency(
              Number(costMetadata.amount),
              costMetadata.currency ?? 'usd',
            )}
          />
        </EventCardBase>
      )}
    </div>
  )
}
