import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export type DeltaChipProps = {
  value: number
  direction: 'up' | 'down'
  tone?: 'semantic' | 'neutral'
}

export const DeltaChip = ({
  value,
  direction,
  tone = 'semantic',
}: DeltaChipProps) => {
  const isDown = direction === 'down'
  const Icon = isDown ? ArrowDownRight : ArrowUpRight
  const isNeutral = tone === 'neutral'

  return (
    <Box display="flex" alignItems="center" columnGap="m">
      <Box
        width={20}
        height={20}
        backgroundColor={
          isNeutral
            ? 'background-inverse'
            : isDown
              ? 'background-danger'
              : 'background-inverse'
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
