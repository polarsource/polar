'use client'

import FormattedUnits from '@/components/Meter/FormattedUnits'
import { schemas } from '@polar-sh/client'
import { ListItem, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ReverseCreditButton } from './ReverseCreditButton'

const describeSource = (
  { metadata }: schemas['MeterCreditEvent'],
  benefits: schemas['Benefit'][],
) => {
  if (metadata.reason === 'manual') {
    return metadata.units < 0 ? 'Manual credit reversed' : 'Manual credit'
  }
  return (
    benefits.find(({ id }) => id === metadata.benefit_id)?.description ??
    'Benefit credit'
  )
}

export const CreditRow = ({
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
      <Box alignItems="center" columnGap="s" minWidth={0}>
        <span className="truncate">{describeSource(credit, benefits)}</span>
        {units < 0 && !manual && (
          <Pill color="red" className="shrink-0 px-2 py-0.5 text-xs">
            Revoked
          </Pill>
        )}
        {reversed && (
          <Pill color="gray" className="shrink-0 px-2 py-0.5 text-xs">
            Reversed
          </Pill>
        )}
      </Box>
      <Box alignItems="center" columnGap="xl" flexShrink={0}>
        {rollover && units > 0 && (
          <Pill color="gray" className="hidden px-2 py-0.5 text-xs md:block">
            Carries over
          </Pill>
        )}
        <Box width={150} justifyContent="end">
          <Text color="muted" tabularNums>
            <FormattedDateTime datetime={credit.timestamp} resolution="time" />
          </Text>
        </Box>
        <Box width={88} justifyContent="end">
          <Text tabularNums>
            <FormattedUnits value={units} />
          </Text>
        </Box>
        <Box width={84} marginVertical="-s" justifyContent="end">
          {reversible && <ReverseCreditButton credit={credit} />}
        </Box>
      </Box>
    </ListItem>
  )
}
