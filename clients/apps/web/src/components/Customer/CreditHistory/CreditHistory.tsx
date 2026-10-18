'use client'

import Pagination from '@/components/Pagination/Pagination'
import { useBenefits } from '@/hooks/queries/benefits'
import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { List, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { CreditRow } from './CreditRow'

const PAGE_SIZE = 20
// Mirrors the reversal endpoint's window; the server enforces the other rules.
const REVERSIBLE_FOR_MS = 7 * 24 * 60 * 60 * 1000

export const CreditHistory = ({
  organization,
  customer,
  meter,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
}) => {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(1)
  const [reversibleSince] = useState(() => Date.now() - REVERSIBLE_FOR_MS)
  const { data } = useEvents(organization.id, {
    name: 'meter.credited',
    customer_id: customer.id,
    metadata: { meter_id: meter.id },
    page,
    limit: PAGE_SIZE,
  })
  const { data: benefits } = useBenefits(organization.id, {
    type: 'meter_credit',
    limit: 100,
  })
  const credits = (data?.items ?? []).filter(
    (event): event is schemas['MeterCreditEvent'] =>
      event.name === 'meter.credited',
  )
  const reversedIds = new Set(
    credits.map((credit) => credit.metadata.reversed_event_id),
  )

  if (credits.length === 0) return null

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Credit history
      </Text>
      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalCount={
          data && 'total_count' in data.pagination
            ? data.pagination.total_count
            : 0
        }
        currentURL={searchParams}
        onPageChange={setPage}
      >
        <List size="small">
          {credits.map((credit) => (
            <CreditRow
              key={credit.id}
              credit={credit}
              benefits={benefits?.items ?? []}
              reversed={reversedIds.has(credit.id)}
              reversibleSince={reversibleSince}
            />
          ))}
        </List>
      </Pagination>
    </Box>
  )
}
