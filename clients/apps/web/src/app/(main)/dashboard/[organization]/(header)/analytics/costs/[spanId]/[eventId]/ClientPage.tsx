'use client'

import { AnonymousCustomerAvatar } from '@/components/Customer/AnonymousCustomerAvatar'
import { useMetadata } from '@/components/Events/EventCard/UserEventCard'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { useEventTypes } from '@/hooks/queries/event_types'
import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { getAnonymousCustomerName } from '@/utils/anonymous-customer'
import { formatSubCentCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import type { LucideIcon } from 'lucide-react'
import { BadgeDollarSignIcon, BotIcon, BracesIcon } from 'lucide-react'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { SpansTitle } from '../../components/SpansTitle'

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

  const { data: childrenData } = useInfiniteEvents(organization.id, {
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

  if (!event) {
    return null
  }

  return (
    <DashboardBody
      title={<SpansTitle organization={organization} eventType={eventType} />}
      header={<div className="h-10" />}
      className="flex flex-col gap-y-8"
    >
      <div className="dark:border-polar-700 dark:bg-polar-900 flex flex-col gap-y-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-start justify-between gap-x-4">
            <div className="flex flex-col gap-y-1">
              <span className="dark:text-polar-500 text-xs text-gray-500">
                {event.name}
              </span>
              <h3 className="text-2xl font-medium">{event.label}</h3>
              <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
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
            {'_cost' in event.metadata && event.metadata._cost && (
              <span className="dark:text-polar-400 font-mono text-3xl text-gray-600 tabular-nums">
                {formatSubCentCurrency(
                  Number(event.metadata._cost?.amount ?? 0),
                  event.metadata._cost?.currency ?? 'usd',
                )}
              </span>
            )}
          </div>

          {(event.customer || event.external_customer_id) && (
            <div className="dark:border-polar-700 border-t border-gray-200 pt-4">
              {event.customer ? (
                <div className="flex flex-row items-center gap-3">
                  <Avatar
                    className="size-10"
                    name={event.customer.name ?? event.customer.email}
                    avatar_url={event.customer.avatar_url ?? null}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {event.customer.name ?? event.customer.email}
                    </span>
                    <span className="dark:text-polar-400 font-mono text-xs text-gray-600">
                      {event.external_customer_id ?? ''}
                    </span>
                  </div>
                </div>
              ) : event.external_customer_id ? (
                <div className="flex flex-row items-center gap-3">
                  <AnonymousCustomerAvatar
                    externalId={event.external_customer_id}
                    className="size-10"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="dark:text-polar-400 text-sm text-gray-600">
                      {getAnonymousCustomerName(event.external_customer_id)[0]}
                    </span>
                    <span className="dark:text-polar-400 font-mono text-xs text-gray-600">
                      {event.external_customer_id}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {event.source === 'user' && (
          <SpanEventDetailsCard
            event={event as schemas['UserEvent']}
            hideCost
          />
        )}
      </div>

      {eventTree && eventType && eventTree.childEvents.length > 0 && (
        <div className="flex flex-col">
          {eventTree.childEvents.map((child, index) => (
            <TreeNode
              key={child.id}
              event={child}
              parentEvent={event}
              isLast={index === eventTree.childEvents.length - 1}
            />
          ))}
        </div>
      )}
    </DashboardBody>
  )
}

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
        'dark:border-polar-700 dark:hover:border-polar-600 flex flex-col gap-4 rounded-2xl border border-gray-200 px-4 pt-3.5 pb-4 text-sm transition-colors duration-150 hover:border-gray-300',
        variant === 'muted' && 'opacity-50',
      )}
    >
      <span className="dark:text-polar-500 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
        <Icon className="mr-1.5 inline-block size-4" />
        {title}
      </span>
      <div>{children}</div>
    </div>
  )
}

const SpanEventDetailsCard = ({
  event,
  hideCost = false,
}: {
  event: schemas['UserEvent']
  hideCost?: boolean
}) => {
  const metadataToRender = useMetadata(event)

  const llmMetadata = '_llm' in event.metadata && event.metadata._llm
  const costMetadata =
    !hideCost && '_cost' in event.metadata && event.metadata._cost

  const hasMetadata = metadataToRender

  return (
    <div className="@container flex flex-col gap-2">
      <div className="grid gap-2 @xl:grid-cols-2">
        <DataCard
          Icon={BracesIcon}
          title="Metadata"
          variant={hasMetadata ? 'default' : 'muted'}
        >
          {hasMetadata ? (
            <div className="text-xs [&_code]:bg-transparent! [&_pre]:bg-transparent!">
              <SyntaxHighlighterProvider>
                <SyntaxHighlighterClient
                  lang="javascript"
                  code={JSON.stringify(metadataToRender, null, 2)}
                />
              </SyntaxHighlighterProvider>
            </div>
          ) : (
            <p className="dark:text-polar-500 text-center text-sm text-gray-500 italic">
              Assign metadata to your events for improved analytics.
            </p>
          )}
        </DataCard>

        {llmMetadata && (
          <DataCard title="LLM" Icon={BotIcon}>
            <dl className="flex flex-col gap-y-2">
              <DataRow label="Vendor" value={llmMetadata.vendor} />
              <DataRow label="Model" value={llmMetadata.model} />
              <DataRow label="Input Tokens" value={llmMetadata.input_tokens} />
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
              <DataRow label="Total Tokens" value={llmMetadata.total_tokens} />
            </dl>
          </DataCard>
        )}
      </div>

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
    </div>
  )
}

function TreeNode({
  event,
  parentEvent,
  depth = 0,
  isLast = false,
}: {
  event: EventTreeNode
  parentEvent?: schemas['Event']
  depth?: number
  isLast?: boolean
}) {
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
        return '0s'
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

  return (
    <div className="group relative flex gap-x-4">
      <div className="relative flex w-3 justify-center">
        <div className="dark:bg-polar-500 absolute top-[10px] z-10 h-3 w-3 rounded-full bg-gray-400" />
        {!isLast && (
          <div className="dark:bg-polar-700 absolute top-[16px] bottom-[-16px] w-0.5 bg-gray-200" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-y-4 pb-8">
        <div className="-ml-1 flex flex-col gap-y-1 rounded-lg p-1 transition-colors duration-150">
          <div className="flex flex-row items-center justify-between gap-2">
            <div className="flex flex-row items-center gap-2">
              <span className="text-base font-medium">{event.label}</span>
              <div className="flex flex-row items-center gap-2">
                {showEventType && (
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    {event.name}
                  </span>
                )}
                <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                  +{formattedTimestamp}
                </span>
              </div>
            </div>

            {costDisplay && (
              <span className="dark:text-polar-500 dark:group-hover:text-polar-300 font-mono text-base text-gray-500 tabular-nums transition-colors duration-150 group-hover:text-gray-700">
                {costDisplay}
              </span>
            )}
          </div>
        </div>

        {event.source === 'user' && (
          <SpanEventDetailsCard
            event={event as schemas['UserEvent']}
            hideCost
          />
        )}

        {event.childEvents.length > 0 && (
          <div className="flex flex-col">
            {event.childEvents.map((child, childIndex) => (
              <TreeNode
                key={child.id}
                event={child}
                parentEvent={event}
                depth={depth + 1}
                isLast={childIndex === event.childEvents.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
