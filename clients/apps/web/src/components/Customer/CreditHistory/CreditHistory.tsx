'use client'

import { useBenefits } from '@/hooks/queries/benefits'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { CreditRow } from './CreditRow'

// Mirrors the reversal endpoint's window; the server enforces the other rules.
const REVERSIBLE_FOR_MS = 7 * 24 * 60 * 60 * 1000

export const CreditHistory = ({
  organization,
  credits,
}: {
  organization: schemas['Organization']
  credits: schemas['MeterCreditEvent'][]
}) => {
  const [reversibleSince] = useState(() => Date.now() - REVERSIBLE_FOR_MS)
  const { data: benefits } = useBenefits(organization.id, {
    type: 'meter_credit',
    limit: 100,
  })

  // A reversal shows on the credit it undoes rather than as its own row.
  const reversedUnits = new Map(
    credits.flatMap(({ metadata }) =>
      metadata.reversed_event_id
        ? [[metadata.reversed_event_id, -metadata.units] as const]
        : [],
    ),
  )
  const rows = credits
    .filter(({ metadata }) => !metadata.reversed_event_id)
    .map((credit) => ({
      credit,
      reversedUnits: reversedUnits.get(credit.id),
      reversible:
        credit.metadata.reason === 'manual' &&
        credit.metadata.units > 0 &&
        !reversedUnits.has(credit.id) &&
        new Date(credit.timestamp).getTime() > reversibleSince,
    }))
  const hasActions = rows.some(({ reversible }) => reversible)

  return (
    <Box flexDirection="column" rowGap="m">
      <Text variant="heading-xxs" as="h3">
        Credits
      </Text>
      {rows.length > 0 ? (
        <Box
          flexDirection="column"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="l"
          overflow="hidden"
        >
          {rows.map((row, index) => (
            <CreditRow
              key={row.credit.id}
              {...row}
              benefits={benefits?.items ?? []}
              hasActions={hasActions}
              divided={index > 0}
            />
          ))}
        </Box>
      ) : (
        <Text color="muted">No credits this period.</Text>
      )}
    </Box>
  )
}
