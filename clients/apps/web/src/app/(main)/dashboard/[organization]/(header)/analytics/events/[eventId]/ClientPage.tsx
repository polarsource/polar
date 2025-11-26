'use client'

import { AnonymousCustomerContextView } from '@/components/Customer/AnonymousCustomerContextView'
import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { LLMInferenceEventCard } from '@/components/Events/EventCard/LLMInferenceEventCard'
import { TreeView } from '@/components/Events/TreeView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEventTypes } from '@/hooks/queries/event_types'
import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import KeyboardArrowUpOutlined from '@mui/icons-material/KeyboardArrowUpOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

const PAGE_SIZE = 50

interface EventDetailPageProps {
  organization: schemas['Organization']
  eventId: string
}

export default function EventDetailPage({
  organization,
  eventId,
}: EventDetailPageProps) {
  const { data: event } = useEvent(organization.id, eventId)
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
      title={
        <div className="flex flex-col gap-y-6">
          {event.parent_id ? (
            <Link
              href={`/dashboard/${organization.slug}/analytics/events/${event.parent_id}`}
              className="flex w-fit flex-row items-center gap-x-4 text-sm"
            >
              <Button
                variant="secondary"
                size="sm"
                className="aspect-square size-6 rounded-md"
              >
                <KeyboardArrowUpOutlined className="h-2 w-2" />
              </Button>
              <span>Parent Event</span>
            </Link>
          ) : eventType ? (
            <Link
              href={`/dashboard/${organization.slug}/analytics/costs/${eventType.id}`}
              className="group -my-2 -ml-3 rounded-xl py-2 pr-3.5 pl-3 transition-colors duration-200 hover:bg-gray-50"
            >
              <span className="flex items-center gap-x-2 overflow-hidden">
                <span className="-translate-x-4 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                  <ArrowLeftIcon strokeWidth={2} className="size-4" />
                </span>
                <span className="-translate-x-6 transition-all duration-200 group-hover:translate-x-0">
                  {eventType.label}
                </span>
              </span>
            </Link>
          ) : (
            <span>Event</span>
          )}
        </div>
      }
      className="flex flex-col gap-y-12"
      contextViewPlacement="right"
      contextView={
        event.customer ? (
          <CustomerContextView
            organization={organization}
            customer={event.customer as schemas['Customer']}
          />
        ) : event.external_customer_id ? (
          <AnonymousCustomerContextView
            externalCustomerId={event.external_customer_id}
          />
        ) : undefined
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:block hidden md:shadow-none"
    >
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between gap-x-4">
          <h3 className="text-4xl">{event.label}</h3>
          {'_cost' in event.metadata && event.metadata._cost && (
            <h3 className="dark:text-polar-500 font-mono text-4xl text-gray-400">
              {formatSubCentCurrency(
                Number(event.metadata._cost?.amount ?? 0),
                event.metadata._cost?.currency ?? 'usd',
              )}
            </h3>
          )}
        </div>
        <span className="dark:text-polar-500 font-mono text-gray-500 capitalize">
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
                <LLMInferenceEventCard event={expandedEvent} />
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardBody>
  )
}
