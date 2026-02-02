'use client'

import { useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { useMemo } from 'react'
import { Events } from '../Events/Events'

const MeterEventsTab = ({
  meter,
  organization,
}: {
  meter: schemas['Meter']
  organization: schemas['Organization']
}) => {
  const { data, fetchNextPage, isFetching, hasNextPage } = useInfiniteEvents(
    organization.id,
    { meter_id: meter.id },
  )
  const meterEvents = useMemo(() => {
    if (!data) return []
    return data.pages.flatMap((page) => page.items)
  }, [data])

  return (
    <div className="flex flex-col gap-2">
      <Events events={meterEvents} organization={organization} />
      {hasNextPage && (
        <Button
          className="self-start"
          variant="secondary"
          onClick={() => fetchNextPage()}
          loading={isFetching}
          disabled={isFetching}
        >
          Load more
        </Button>
      )}
    </div>
  )
}

export default MeterEventsTab
