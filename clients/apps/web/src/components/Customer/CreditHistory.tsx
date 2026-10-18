'use client'

import FormattedUnits from '@/components/Meter/FormattedUnits'
import Pagination from '@/components/Pagination/Pagination'
import { useBenefits } from '@/hooks/queries/benefits'
import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

const PAGE_SIZE = 20

const CreditListItem = ({
  credit,
  benefits,
}: {
  credit: schemas['MeterCreditEvent']
  benefits: schemas['Benefit'][]
}) => {
  const { reason, units, rollover, benefit_id } = credit.metadata
  const manual = reason === 'manual'
  const title = manual
    ? 'Manual credit'
    : (benefits.find((benefit) => benefit.id === benefit_id)?.description ??
      'Benefit credit')

  return (
    <ListItem className="text-sm">
      <Box alignItems="center" columnGap="s" minWidth={0}>
        <span className="truncate">{title}</span>
        {units < 0 && (
          <Pill color="red" className="shrink-0 px-2 py-0.5 text-xs">
            {manual ? 'Reversed' : 'Revoked'}
          </Pill>
        )}
      </Box>
      <Box alignItems="center" columnGap="xl" flexShrink={0}>
        {rollover && units > 0 && (
          <Pill color="gray" className="hidden px-2 py-0.5 text-xs md:block">
            Carries over
          </Pill>
        )}
        <Text color="muted" tabularNums>
          <FormattedDateTime datetime={credit.timestamp} resolution="time" />
        </Text>
        <Box width={88} justifyContent="end">
          <Text tabularNums>
            <FormattedUnits value={units} />
          </Text>
        </Box>
      </Box>
    </ListItem>
  )
}

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

  if (credits.length === 0) return null

  return (
    <Box flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h3">
          Credit history
        </Text>
        <Text color="muted">
          Credits granted by benefits and added manually
        </Text>
      </Box>
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
            <CreditListItem
              key={credit.id}
              credit={credit}
              benefits={benefits?.items ?? []}
            />
          ))}
        </List>
      </Pagination>
    </Box>
  )
}
