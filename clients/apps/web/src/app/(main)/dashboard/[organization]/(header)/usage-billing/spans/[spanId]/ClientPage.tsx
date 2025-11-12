'use client'

import { Events } from '@/components/Events/Events'
import { useEventDisplayName } from '@/components/Events/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'

const PAGE_SIZE = 50

interface SpanDetailPageProps {
  organization: schemas['Organization']
  spanId: string
}

export default function SpanDetailPage({
  organization,
  spanId,
}: SpanDetailPageProps) {
  const [eventName] = useQueryState('eventName', parseAsString)

  const {
    data: eventsData,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(
    organization.id,
    {
      name: eventName ? [eventName] : null,
      limit: PAGE_SIZE,
      sorting: ['-timestamp'],
    },
    !!eventName,
  )

  const events = useMemo(() => {
    if (!eventsData) return []
    return eventsData.pages.flatMap((page) => page.items)
  }, [eventsData])

  const eventDisplayName = useEventDisplayName(eventName ?? '')

  if (!eventName) {
    return (
      <DashboardBody title="Span">
        <div className="flex flex-col gap-y-4">
          <p className="dark:text-polar-500 text-gray-500">
            No event name provided
          </p>
        </div>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody title="Span" className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-4">
        <h3 className="text-4xl">{eventDisplayName}</h3>
      </div>
      {events.length > 0 ? (
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row justify-between">
            <h3 className="text-2xl">Events</h3>
            <h3 className="dark:text-polar-500 text-2xl text-gray-400">
              {events.length} {events.length === 1 ? 'Event' : 'Events'}
            </h3>
          </div>
          <div className="flex flex-col gap-y-3">
            <Events events={events} organization={organization} />
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
      ) : (
        <div className="dark:border-polar-700 flex min-h-96 w-full flex-col items-center justify-center gap-4 rounded-4xl border border-gray-200 p-24">
          <h1 className="text-2xl font-normal">No Events Found</h1>
          <p className="dark:text-polar-500 text-gray-500">
            There are no events matching this span
          </p>
        </div>
      )}
    </DashboardBody>
  )
}
