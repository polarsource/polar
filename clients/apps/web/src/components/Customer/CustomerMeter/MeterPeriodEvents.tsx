'use client'

import { Events } from '@/components/Events/Events'
import Pagination from '@/components/Pagination/Pagination'
import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { MeterPeriod } from './useMeterPeriods'

const PAGE_SIZE = 10

export const MeterPeriodEvents = ({
  organization,
  customer,
  meter,
  period,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
  period: MeterPeriod
}) => {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(1)
  const [now] = useState(() => new Date())
  const { data } = useEvents(organization.id, {
    meter_id: meter.id,
    customer_id: customer.id,
    start_timestamp: period.start.toISOString(),
    end_timestamp: (period.end ?? now).toISOString(),
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
            {totalCount.toLocaleString('en-US')} this period
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
          <Events events={data.items} organization={organization} />
        </Pagination>
      ) : (
        <Text color="muted">No events this period.</Text>
      )}
    </Box>
  )
}
