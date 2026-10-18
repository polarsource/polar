'use client'

import FormattedUnits from '@/components/Meter/FormattedUnits'
import { useBenefits } from '@/hooks/queries/benefits'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Button, List, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useMemo, useState } from 'react'
import { CreditPeriod, groupCreditsByPeriod } from './creditPeriods'
import { CreditRow } from './CreditRow'

// Mirrors the reversal endpoint's window; the server enforces the other rules.
const REVERSIBLE_FOR_MS = 7 * 24 * 60 * 60 * 1000

const PeriodLabel = ({ period }: { period: CreditPeriod }) => {
  const start =
    period.start ?? period.rows[period.rows.length - 1].credit.timestamp
  if (period.end === null) {
    return (
      <Text variant="label">
        Current period{' '}
        <Text as="span" color="muted">
          · since <FormattedDateTime datetime={start} />
        </Text>
      </Text>
    )
  }
  return (
    <Text variant="label" color="muted">
      <FormattedDateTime datetime={start} /> –{' '}
      <FormattedDateTime datetime={period.end} />
    </Text>
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
  const [reversibleSince] = useState(() => Date.now() - REVERSIBLE_FOR_MS)
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteEvents(organization.id, {
      name: ['meter.credited', 'meter.reset'],
      customer_id: customer.id,
      metadata: { meter_id: meter.id },
      limit: 50,
    })
  const { data: benefits } = useBenefits(organization.id, {
    type: 'meter_credit',
    limit: 100,
  })
  const periods = useMemo(
    () =>
      groupCreditsByPeriod(
        (data?.pages.flatMap((page) => page.items) ?? []).filter(
          (
            event,
          ): event is
            | schemas['MeterCreditEvent']
            | schemas['MeterResetEvent'] =>
            event.name === 'meter.credited' || event.name === 'meter.reset',
        ),
      ),
    [data],
  )

  if (periods.length === 0) return null

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Credit history
      </Text>
      {periods.map((period) => (
        <Box key={period.end ?? 'current'} flexDirection="column" rowGap="s">
          <Box justifyContent="between" paddingHorizontal="l">
            <PeriodLabel period={period} />
            <Text color="muted" tabularNums>
              <FormattedUnits value={period.total} /> credited
            </Text>
          </Box>
          <List size="small">
            {period.rows.map((row) => (
              <CreditRow
                key={row.credit.id}
                row={row}
                benefits={benefits?.items ?? []}
                reversibleSince={reversibleSince}
              />
            ))}
          </List>
        </Box>
      ))}
      {hasNextPage && (
        <Box justifyContent="center">
          <Button
            variant="secondary"
            size="sm"
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Show more
          </Button>
        </Box>
      )}
    </Box>
  )
}
