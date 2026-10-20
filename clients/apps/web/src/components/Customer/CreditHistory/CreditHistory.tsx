'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { CreditRow } from './CreditRow'

// Mirroring backend limit
const REVERSIBLE_FOR_MS = 7 * 24 * 60 * 60 * 1000

export const CreditHistory = ({
  credits,
}: {
  credits: schemas['MeterCreditEvent'][]
}) => {
  const [reversibleSince] = useState(() => Date.now() - REVERSIBLE_FOR_MS)

  const { rows, hasActions } = useMemo(() => {
    const reversedUnits = new Map(
      credits.flatMap(({ parent_id, metadata }) =>
        parent_id ? [[parent_id, -metadata.units] as const] : [],
      ),
    )
    const creditIds = new Set(credits.map(({ id }) => id))
    const rows = credits
      .filter(({ parent_id }) => !parent_id || !creditIds.has(parent_id))
      .map((credit) => ({
        credit,
        reversedUnits: reversedUnits.get(credit.id),
        reversible:
          credit.metadata.reason === 'manual' &&
          credit.metadata.units > 0 &&
          !reversedUnits.has(credit.id) &&
          new Date(credit.timestamp).getTime() > reversibleSince,
      }))
    return { rows, hasActions: rows.some(({ reversible }) => reversible) }
  }, [credits, reversibleSince])

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
              hasActions={hasActions}
              divided={index > 0}
            />
          ))}
        </Box>
      ) : (
        <Text color="muted">No credits in this date range.</Text>
      )}
    </Box>
  )
}
