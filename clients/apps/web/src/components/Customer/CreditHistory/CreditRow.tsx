'use client'

import { schemas } from '@polar-sh/client'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReverseCreditButton } from './ReverseCreditButton'

const describeSource = (
  { metadata }: schemas['MeterCreditEvent'],
  benefits: schemas['Benefit'][],
) => {
  if (metadata.reason === 'manual') return 'Manual credit'
  const name =
    benefits.find(({ id }) => id === metadata.benefit_id)?.description ??
    'Plan credits'
  return metadata.units < 0 ? `${name} revoked` : name
}

const formatUnits = (units: number) =>
  `${units < 0 ? '−' : '+'}${Math.abs(units).toLocaleString('en-US')}`

export const CreditRow = ({
  credit,
  benefits,
  reversedUnits,
  reversible,
  hasActions,
  divided,
}: {
  credit: schemas['MeterCreditEvent']
  benefits: schemas['Benefit'][]
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
        <Text truncate>{describeSource(credit, benefits)}</Text>
        {reversed && (
          <Text color="muted" wrap="nowrap">
            {reversedUnits < units
              ? `${reversedUnits.toLocaleString('en-US')} reversed`
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
