'use client'

import { useMeterEvents } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useMemo } from 'react'
import { MeterEvents } from './MeterEvents'

const MeterEventsTab = ({ meter }: { meter: schemas['Meter'] }) => {
  const { data, fetchNextPage, isFetching, hasNextPage } = useMeterEvents(
    meter.id,
  )
  const meterEvents = useMemo(() => {
    if (!data) return []
    return data.pages.flatMap((page) => page.items)
  }, [data])

  return (
    <div className="flex flex-col gap-2">
      <MeterEvents events={meterEvents} />
      {hasNextPage && (
        <Button
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
