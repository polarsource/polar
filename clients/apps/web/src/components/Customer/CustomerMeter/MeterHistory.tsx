'use client'

import { AddCreditsButton } from '@/components/Customer/AddCredits/AddCreditsButton'
import {
  CreditRow,
  HistoryRow,
} from '@/components/Customer/CreditHistory/CreditRow'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'

// Mirroring backend limit
const REVERSIBLE_FOR_MS = 7 * 24 * 60 * 60 * 1000

export type MeterHistoryEvent =
  | schemas['MeterCreditEvent']
  | schemas['MeterResetEvent']

type HistoryRowData =
  | {
      credit: schemas['MeterCreditEvent']
      reversedUnits: number | undefined
      reversible: boolean
    }
  | { event: schemas['MeterResetEvent'] }

const isCredit = (
  event: MeterHistoryEvent,
): event is schemas['MeterCreditEvent'] => event.name === 'meter.credited'

export const MeterHistory = ({
  organization,
  customer,
  meterId,
  events,
  currentPeriodStart,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meterId: string
  events: MeterHistoryEvent[]
  currentPeriodStart: Date | null
}) => {
  const [reversibleSince] = useState(() => Date.now() - REVERSIBLE_FOR_MS)

  const { rows, hasActions } = useMemo(() => {
    const since = Math.max(reversibleSince, currentPeriodStart?.getTime() ?? 0)
    const credits = events.filter(isCredit)
    const reversedUnits = new Map(
      credits.flatMap(({ parent_id, metadata }) =>
        parent_id ? [[parent_id, -metadata.units] as const] : [],
      ),
    )
    const creditIds = new Set(credits.map(({ id }) => id))
    const rows = events
      .filter(
        (event) =>
          !isCredit(event) ||
          !event.parent_id ||
          !creditIds.has(event.parent_id),
      )
      .map(
        (event): HistoryRowData =>
          isCredit(event)
            ? {
                credit: event,
                reversedUnits: reversedUnits.get(event.id),
                reversible:
                  event.metadata.reason === 'manual' &&
                  event.metadata.units > 0 &&
                  !reversedUnits.has(event.id) &&
                  new Date(event.timestamp).getTime() >= since,
              }
            : { event },
      )
    return {
      rows,
      hasActions: rows.some((row) => 'credit' in row && row.reversible),
    }
  }, [events, reversibleSince, currentPeriodStart])

  return (
    <Box
      flexDirection="column"
      flex={1}
      minHeight={0}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        justifyContent="between"
        alignItems="center"
        columnGap="m"
        paddingHorizontal="xl"
        paddingVertical="m"
      >
        <Text as="h3" color="muted">
          Timeline
        </Text>
        <AddCreditsButton
          organization={organization}
          customer={customer}
          meterId={meterId}
          size="sm"
        />
      </Box>
      {rows.length > 0 ? (
        <Box
          flexDirection="column"
          flex={1}
          minHeight={0}
          maxHeight={{ base: 320, lg: 'none' }}
          overflowY="auto"
        >
          {rows.map((row) =>
            'credit' in row ? (
              <CreditRow key={row.credit.id} {...row} hasActions={hasActions} />
            ) : (
              <HistoryRow
                key={row.event.id}
                timestamp={row.event.timestamp}
                hasActions={hasActions}
              >
                <Text truncate>Usage reset</Text>
                <span />
                {hasActions && <span />}
              </HistoryRow>
            ),
          )}
        </Box>
      ) : (
        <Box paddingHorizontal="xl" paddingBottom="l">
          <Text color="muted">Nothing in this date range.</Text>
        </Box>
      )}
    </Box>
  )
}
