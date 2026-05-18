import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export type DeltaChipProps = {
  value: number
  direction: 'up' | 'down'
  /**
   * Optional sentiment hint. Determines the chip background colour
   * independently of `direction` — e.g. a downward trend in costs is
   * positive even though the arrow points down. Defaults to mirroring
   * `direction` (up = positive, down = negative).
   */
  sentiment?: 'positive' | 'negative'
}

export const DeltaChip = ({ value, direction, sentiment }: DeltaChipProps) => {
  const isDown = direction === 'down'
  const Icon = isDown ? ArrowDownRight : ArrowUpRight
  const effectiveSentiment = sentiment ?? (isDown ? 'negative' : 'positive')
  const isNegative = effectiveSentiment === 'negative'

  return (
    <Box display="flex" alignItems="center" columnGap="m">
      <Box
        width={20}
        height={20}
        backgroundColor={
          isNegative ? 'background-danger' : 'background-inverse'
        }
        color="text-inverse"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={16} strokeWidth={2.25} />
      </Box>
      <Text variant="heading-xs" color="default">
        {value}%
      </Text>
    </Box>
  )
}
