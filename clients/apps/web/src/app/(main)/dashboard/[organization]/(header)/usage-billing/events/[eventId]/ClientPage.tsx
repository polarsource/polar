'use client'

import { EventRow } from '@/components/Events/EventRow'
import { useEventDisplayName } from '@/components/Events/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEvent, useEvents } from '@/hooks/queries/events'
import { formatSubCentCurrency } from '@/utils/formatters'
import KeyboardArrowUpOutlined from '@mui/icons-material/KeyboardArrowUpOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

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
    fetchNextPage,
    hasNextPage,
    isFetching,
  } = useEvents(organization.id, {
    parent_id: eventId,
    limit: PAGE_SIZE,
    sorting: ['timestamp'],
  })

  const eventDisplayName = useEventDisplayName(event?.name)

  if (!event) {
    return null
  }

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-y-6">
          {event.parent_id && (
            <Link
              href={`/dashboard/${organization.slug}/usage-billing/events/${event.parent_id}`}
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
          )}
        </div>
      }
      className="flex flex-col gap-y-12"
    >
      <div className="flex flex-row items-center justify-between gap-x-4">
        <h3 className="text-4xl">{eventDisplayName}</h3>
        {'_cost' in event.metadata && event.metadata._cost && (
          <h3 className="dark:text-polar-500 font-mono text-4xl text-gray-500">
            {formatSubCentCurrency(Number(event.metadata._cost?.amount ?? 0))}
          </h3>
        )}
      </div>
      <div className="flex flex-col gap-y-3">
        <EventRow
          event={event}
          organization={organization}
          expanded={true}
          depth={0}
          renderChildren={false}
        />
      </div>
      {childrenData?.items.length && childrenData?.items.length > 0 ? (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row justify-between">
            <h3 className="text-2xl">Child Events</h3>
            <h3 className="dark:text-polar-500 text-2xl text-gray-500">
              {childrenData?.pagination.total_count}{' '}
              {childrenData?.pagination.total_count === 1 ? 'Event' : 'Events'}
            </h3>
          </div>
          <div className="flex flex-col gap-y-3">
            {childrenData?.items.map((child) => (
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
                onClick={fetchNextPage}
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
