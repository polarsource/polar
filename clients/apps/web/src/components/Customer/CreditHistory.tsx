'use client'

import FormattedUnits from '@/components/Meter/FormattedUnits'
import Pagination from '@/components/Pagination/Pagination'
import { useBenefits } from '@/hooks/queries/benefits'
import { useEvents } from '@/hooks/queries/events'
import DiamondOutlined from '@mui/icons-material/DiamondOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import { schemas } from '@polar-sh/client'
import { List, ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ReverseCreditButton } from './ReverseCreditButton'

const PAGE_SIZE = 20
// Mirrors the reversal endpoint's window; the server enforces the other rules.
const REVERSIBLE_FOR_MS = 7 * 24 * 60 * 60 * 1000

const describeSource = (
  { metadata }: schemas['MeterCreditEvent'],
  benefits: schemas['Benefit'][],
) => {
  if (metadata.reason === 'manual') {
    return metadata.units < 0 ? 'Reversal of a manual credit' : 'Added manually'
  }
  const benefit =
    benefits.find(({ id }) => id === metadata.benefit_id)?.description ??
    'Benefit'
  return metadata.units < 0 ? `${benefit} · revoked` : benefit
}

const CreditListItem = ({
  credit,
  benefits,
  reversed,
  reversibleSince,
}: {
  credit: schemas['MeterCreditEvent']
  benefits: schemas['Benefit'][]
  reversed: boolean
  reversibleSince: number
}) => {
  const { reason, units, rollover } = credit.metadata
  const manual = reason === 'manual'
  const reversible =
    manual &&
    units > 0 &&
    !reversed &&
    new Date(credit.timestamp).getTime() > reversibleSince

  return (
    <ListItem className="text-sm">
      <Box alignItems="center" columnGap="m" minWidth={0}>
        <Box
          width={32}
          height={32}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          backgroundColor="background-secondary"
          color="text-secondary"
        >
          {manual ? (
            <PersonOutlineOutlined fontSize="small" />
          ) : (
            <DiamondOutlined fontSize="small" />
          )}
        </Box>
        <Box flexDirection="column" minWidth={0}>
          <Box alignItems="center" columnGap="s">
            <Text tabularNums>
              {units > 0 && '+'}
              <FormattedUnits value={units} />
            </Text>
            <Text color="muted">credits</Text>
            {reversed && (
              <Pill color="gray" className="px-2 py-0.5 text-xs">
                Reversed
              </Pill>
            )}
          </Box>
          <Text as="span" variant="caption" color="muted" truncate>
            {describeSource(credit, benefits)}
            {rollover && units > 0 && ' · carries over'}
          </Text>
        </Box>
      </Box>
      <Box alignItems="center" columnGap="xl" flexShrink={0}>
        <Text color="muted" tabularNums>
          <FormattedDateTime datetime={credit.timestamp} resolution="time" />
        </Text>
        <Box width={84} justifyContent="end">
          {reversible && <ReverseCreditButton credit={credit} />}
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
              reversed={reversedIds.has(credit.id)}
              reversibleSince={reversibleSince}
            />
          ))}
        </List>
      </Pagination>
    </Box>
  )
}
