'use client'

import { useMetadata } from '@/components/Events/EventCard/UserEventCard'
import { EventCustomer } from '@/components/Events/EventCustomer'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  ArrowDownFromLineIcon,
  ArrowUpFromLineIcon,
  BotIcon,
  HardDriveDownloadIcon,
  SigmaIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CostDeviationBar } from './CostDeviationBar'

type EventTreeNode = schemas['Event'] & { childEvents: EventTreeNode[] }

const SpanEventDetailsCard = ({ event }: { event: schemas['UserEvent'] }) => {
  const metadataToRender = useMetadata(event)

  const llmMetadata = '_llm' in event.metadata && event.metadata._llm

  const hasMetadata = metadataToRender

  return (
    <div className="@container flex flex-col gap-2">
      <div className="flex flex-col gap-4">
        {hasMetadata && (
          <div className="text-xs [&_code]:bg-transparent! [&_pre]:bg-transparent!">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="javascript"
                code={JSON.stringify(metadataToRender, null, 2)}
              />
            </SyntaxHighlighterProvider>
          </div>
        )}

        {llmMetadata && (
          <div className="dark:border-polar-700 dark:hover:border-polar-600 flex flex-row gap-4 rounded-2xl bg-gray-50 px-4 pt-3.5 pb-4 text-sm text-xs">
            <dl className="flex flex-row items-center gap-4">
              <div className="flex flex-row items-center gap-1 font-mono">
                <dt>
                  <BotIcon className="dark:text-polar-500 size-3 text-gray-500" />
                </dt>
                <dd>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <span>{llmMetadata.vendor}</span>/
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <span>{llmMetadata.model}</span>
                </dd>
              </div>
              <div className="flex flex-row items-center gap-1 font-mono">
                <dt>
                  <ArrowUpFromLineIcon className="dark:text-polar-500 size-3 text-gray-500" />
                </dt>
                <dd>{llmMetadata.input_tokens}</dd>
              </div>
              {llmMetadata.cached_input_tokens && (
                <div className="flex flex-row items-center gap-1 font-mono">
                  <dt>
                    <HardDriveDownloadIcon className="dark:text-polar-500 size-3 rotate-180 transform text-gray-500" />
                  </dt>
                  <dd>{llmMetadata.cached_input_tokens}</dd>
                </div>
              )}
              <div className="flex flex-row items-center gap-1 font-mono">
                <dt>
                  <ArrowDownFromLineIcon className="dark:text-polar-500 size-3 text-gray-500" />
                </dt>
                <dd>{llmMetadata.output_tokens}</dd>
              </div>
              <div className="flex flex-row items-center gap-1 font-mono">
                <dt>
                  <SigmaIcon className="dark:text-polar-500 size-3 text-gray-500" />
                </dt>
                <dd>{llmMetadata.total_tokens}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
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
      return formatCurrency('subcent')(
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
        <div className="dark:bg-polar-500 absolute top-[10px] z-10 h-3 w-3 rounded-full bg-gray-200" />
        {!isLast && (
          <div className="dark:bg-polar-700 absolute top-[16px] bottom-[-16px] w-0.5 bg-gray-200" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-y-4 pb-8">
        <div className="-ml-1 flex flex-col gap-y-1 rounded-lg p-1 transition-colors duration-150">
          <div className="flex flex-row items-center justify-between gap-2">
            <div className="flex flex-row items-center gap-2">
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span className="text-sm font-medium">{event.label}</span>
              <div className="flex flex-row items-center gap-2">
                {showEventType && (
                  <>
                    {/* eslint-disable-next-line no-restricted-syntax */}
                    <span className="dark:text-polar-500 text-xs text-gray-500">
                      {event.name}
                    </span>
                  </>
                )}
                {/* eslint-disable-next-line no-restricted-syntax */}
                <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                  +{formattedTimestamp}
                </span>
              </div>
            </div>

            {costDisplay && (
              <>
                {/* eslint-disable-next-line no-restricted-syntax */}
                <span className="dark:text-polar-500 dark:group-hover:text-polar-300 font-mono text-sm text-gray-500 tabular-nums transition-colors duration-150 group-hover:text-gray-700">
                  {costDisplay}
                </span>
              </>
            )}
          </div>
        </div>

        {event.source === 'user' && (
          <SpanEventDetailsCard event={event as schemas['UserEvent']} />
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

function EventDetail({
  organizationId,
  eventId,
}: {
  organizationId: string
  eventId: string
}) {
  const { data: event, isLoading } = useEvent(organizationId, eventId, {
    aggregate_fields: ['_cost.amount'],
  })

  const { data: childrenData } = useInfiniteEvents(organizationId, {
    parent_id: eventId,
    limit: 50,
    sorting: ['timestamp'],
    depth: 5,
  })

  const childEvents = useMemo(() => {
    if (!childrenData) return []
    return childrenData.pages.flatMap((page) => page.items)
  }, [childrenData])

  const eventTree = useMemo(() => {
    if (!event) return null
    const buildTree = (parentId: string): EventTreeNode[] => {
      return childEvents
        .filter((e) => e.parent_id === parentId)
        .map((e) => ({ ...e, childEvents: buildTree(e.id) }))
    }
    return { ...event, childEvents: buildTree(eventId) }
  }, [event, childEvents, eventId])

  if (!event || isLoading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-4">
      {event.source === 'user' && (
        <SpanEventDetailsCard event={event as schemas['UserEvent']} />
      )}
      {eventTree && eventTree.childEvents.length > 0 && (
        <div className="mt-4 flex flex-col">
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
    </div>
  )
}

interface EventRowProps {
  eventType: schemas['EventType']
  event: schemas['Event']
  organization: schemas['Organization']
  costDeviationMetadata?: {
    average: number
    p10: number
    p90: number
  }
  showEventType?: boolean
}

export function EventRow({
  eventType,
  event,
  organization,
  costDeviationMetadata,
  showEventType = true,
}: EventRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const costMetadata = (event.metadata as { _cost: { amount: string } })._cost
  const parsedCost = costMetadata ? Number(costMetadata.amount) : 0

  return (
    <>
      <tr>
        {showEventType && eventType && (
          <td
            className={twMerge(
              'p-2',
              isExpanded && 'dark:bg-polar-700 bg-gray-50',
            )}
          >
            <Link
              href={`/dashboard/${organization.slug}/analytics/costs/${eventType.id}`}
              className="dark:text-polar-500 text-sm text-gray-500"
            >
              {eventType.label}
            </Link>
          </td>
        )}

        <td
          className={twMerge(
            'p-2',
            isExpanded && 'dark:bg-polar-700 bg-gray-50',
          )}
        >
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-medium"
          >
            {event.label === eventType.label ? (
              <>
                {/* eslint-disable-next-line no-restricted-syntax */}
                <span className="dark:text-polar-200 truncate font-mono font-normal text-gray-600">
                  {event.id}
                </span>
              </>
            ) : (
              event.label
            )}
          </button>
        </td>

        <td
          className={twMerge(
            'p-2',
            isExpanded && 'dark:bg-polar-700 bg-gray-50',
          )}
        >
          <EventCustomer event={event} />
        </td>

        <td
          className={twMerge(
            'dark:text-polar-500 p-2 text-sm text-gray-600',
            isExpanded && 'dark:bg-polar-700 bg-gray-50',
          )}
        >
          <FormattedDateTime datetime={event.timestamp} resolution="time" />
        </td>

        <td
          className={twMerge(
            'p-2 text-right text-sm tabular-nums',
            isExpanded && 'dark:bg-polar-700 bg-gray-50',
          )}
        >
          {costMetadata && (
            <div className="ml-auto flex flex-row items-center justify-end gap-x-3">
              {/* eslint-disable-next-line no-restricted-syntax */}
              <span className="font-mono">
                {formatCurrency('subcent')(
                  parsedCost,
                  (
                    event.metadata as {
                      _cost: { amount: string; currency: string }
                    }
                  )._cost.currency ?? 'usd',
                )}
              </span>

              {costDeviationMetadata && (
                <CostDeviationBar
                  eventCost={parsedCost}
                  averageCost={costDeviationMetadata.average}
                  p10Cost={costDeviationMetadata.p10}
                  p90Cost={costDeviationMetadata.p90}
                />
              )}
            </div>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={showEventType ? 5 : 4}>
            <EventDetail organizationId={organization.id} eventId={event.id} />
          </td>
        </tr>
      )}
    </>
  )
}
