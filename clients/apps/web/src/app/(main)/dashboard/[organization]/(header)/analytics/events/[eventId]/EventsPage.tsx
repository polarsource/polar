'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { EventRow } from '@/components/Events/EventRow'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import KeyboardArrowUpOutlined from '@mui/icons-material/KeyboardArrowUpOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
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

  const {
    data: childrenData,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(organization.id, {
    parent_id: eventId,
    limit: PAGE_SIZE,
    sorting: ['timestamp'],
    depth: 1,
  })

  const children = useMemo(() => {
    if (!childrenData) return []
    return childrenData.pages.flatMap((page) => page.items)
  }, [childrenData])

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
      <div className="flex flex-col gap-y-3">
        <EventRow
          event={event}
          organization={organization}
          expanded={true}
          depth={0}
          renderChildren={false}
          renderEventLink={false}
        />
      </div>
      {children.length > 0 ? (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row justify-between">
            <h3 className="text-2xl">Child Events</h3>
            <h3 className="dark:text-polar-500 text-2xl text-gray-400">
              {children.length} {children.length === 1 ? 'Event' : 'Events'}
            </h3>
          </div>
          <div className="flex flex-col gap-y-3">
            {children.map((child) => (
              <EventRow
                key={child.id}
                event={child}
                organization={organization}
                expanded
                renderChildren={false}
              />
            ))}
            {hasNextPage && (
              <Button
                className="self-start"
                variant="secondary"
                onClick={() => fetchNextPage()}
                loading={isFetching}
              >
                Load More
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </DashboardBody>
  )
}
