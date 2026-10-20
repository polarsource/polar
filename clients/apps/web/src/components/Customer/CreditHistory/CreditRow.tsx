'use client'

import { formatScalar } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReverseCreditButton } from './ReverseCreditButton'

const describeSource = ({
  metadata,
  parent_id,
}: schemas['MeterCreditEvent']) => {
  if (parent_id) return 'Manual credit reversal'
  if (metadata.reason === 'manual') return 'Manual credit'
  return metadata.units < 0 ? 'Benefit credits revoked' : 'Benefit credits'
}

const formatUnits = (units: number) =>
  `${units < 0 ? '−' : '+'}${formatScalar(Math.abs(units))}`

export const CreditRow = ({
  credit,
  reversedUnits,
  reversible,
  hasActions,
  divided,
}: {
  credit: schemas['MeterCreditEvent']
  reversedUnits: number | undefined
  reversible: boolean
  hasActions: boolean
  divided: boolean
}) => {
  const { units } = credit.metadata
  const reversed = reversedUnits !== undefined

  return (
    <Grid
      templateColumns={`64px minmax(0, 1fr) auto${hasActions ? ' 88px' : ''}`}
      columnGap="l"
      alignItems="center"
      paddingHorizontal="l"
      height={48}
      borderTopWidth={divided ? 1 : 0}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Text color="muted" tabularNums>
        {new Date(credit.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </Text>
      <Box columnGap="s" minWidth={0} alignItems="baseline">
        <Text truncate>{describeSource(credit)}</Text>
        {reversed && (
          <Text color="muted" wrap="nowrap">
            {reversedUnits < units
              ? `${formatScalar(reversedUnits)} reversed`
              : 'Reversed'}
          </Text>
        )}
      </Box>
      <Text tabularNums color={units < 0 || reversed ? 'muted' : 'default'}>
        {reversed && reversedUnits >= units ? (
          <s>{formatUnits(units)}</s>
        ) : (
          formatUnits(units)
        )}
      </Text>
      {hasActions && (
        <Box justifyContent="end">
          {reversible && <ReverseCreditButton credit={credit} />}
        </Box>
      )}
    </Grid>
  )
}
