'use client'

import FormattedUnits from '@/components/Meter/FormattedUnits'
import { schemas } from '@polar-sh/client'
import { ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { CreditRow as CreditRowData } from './creditPeriods'
import { ReverseCreditMenu } from './ReverseCreditMenu'

const describeSource = (
  { metadata }: schemas['MeterCreditEvent'],
  benefits: schemas['Benefit'][],
) => {
  if (metadata.reason === 'manual') {
    return metadata.units < 0 ? 'Manual credit reversal' : 'Manual credit'
  }
  return (
    benefits.find(({ id }) => id === metadata.benefit_id)?.description ??
    'Benefit credit'
  )
}

export const CreditRow = ({
  row: { credit, reversal },
  benefits,
  reversibleSince,
}: {
  row: CreditRowData
  benefits: schemas['Benefit'][]
  reversibleSince: number
}) => {
  const { reason, units, rollover } = credit.metadata
  const reversedUnits = reversal ? Math.abs(reversal.metadata.units) : 0
  const fullyReversed = reversal !== undefined && reversedUnits >= units
  const reversible =
    reason === 'manual' &&
    units > 0 &&
    !reversal &&
    new Date(credit.timestamp).getTime() > reversibleSince

  return (
    <ListItem className="text-sm">
      <Box alignItems="center" columnGap="xl" minWidth={0}>
        <Box width={80} flexShrink={0} justifyContent="end">
          <Text
            tabularNums
            variant="label"
            color={fullyReversed ? 'muted' : 'default'}
          >
            {fullyReversed ? (
              <s>
                <FormattedUnits value={units} />
              </s>
            ) : (
              <FormattedUnits value={units} />
            )}
          </Text>
        </Box>
        <Box alignItems="center" columnGap="s" minWidth={0}>
          <span className="truncate">{describeSource(credit, benefits)}</span>
          {units < 0 && reason !== 'manual' && (
            <Pill color="red" className="shrink-0 px-2 py-0.5 text-xs">
              Revoked
            </Pill>
          )}
          {reversal && (
            <Pill color="gray" className="shrink-0 px-2 py-0.5 text-xs">
              {reversedUnits < units
                ? `${reversedUnits.toLocaleString('en-US')} reversed`
                : 'Reversed'}
            </Pill>
          )}
          {rollover && units > 0 && !reversal && (
            <Pill
              color="gray"
              className="hidden shrink-0 px-2 py-0.5 text-xs md:block"
            >
              Carries over
            </Pill>
          )}
        </Box>
      </Box>
      <Box alignItems="center" columnGap="l" flexShrink={0}>
        <Text color="muted" tabularNums>
          <FormattedDateTime datetime={credit.timestamp} resolution="time" />
        </Text>
        <Box width={32} marginVertical="-s" justifyContent="end">
          {reversible && <ReverseCreditMenu credit={credit} />}
        </Box>
      </Box>
    </ListItem>
  )
}
