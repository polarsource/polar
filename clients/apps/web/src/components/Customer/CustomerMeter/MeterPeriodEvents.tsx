'use client'

import { EventRow } from '@/components/Events/EventRow'
import Pagination from '@/components/Pagination/Pagination'
import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, useQueryState } from 'nuqs'

const PAGE_SIZE = 25

export const MeterPeriodEvents = ({
  organization,
  customer,
  meter,
  startDate,
  endDate,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
  startDate: Date
  endDate: Date
}) => {
  const searchParams = useSearchParams()
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const { data } = useEvents(organization.id, {
    meter_id: meter.id,
    customer_id: customer.id,
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    page,
    limit: PAGE_SIZE,
  })
  const totalCount =
    data && 'total_count' in data.pagination ? data.pagination.total_count : 0

  return (
    <Box flexDirection="column" rowGap="m">
      <Box justifyContent="between" alignItems="baseline">
        <Text variant="heading-xxs" as="h3">
          Events
        </Text>
        {data?.items.length ? (
          <Text color="muted" tabularNums>
            {totalCount.toLocaleString('en-US')} total
          </Text>
        ) : null}
      </Box>
      {data?.items.length ? (
        <Pagination
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          currentURL={searchParams}
          onPageChange={setPage}
        >
          <Box flexDirection="column" rowGap="m">
            {data.items.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                organization={organization}
                renderChildren={false}
              />
            ))}
          </Box>
        </Pagination>
      ) : (
        <Text color="muted">No events in this date range.</Text>
      )}
    </Box>
  )
}
