import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export type DeltaChipProps = {
  value: number
  direction: 'up' | 'down'
}

export const DeltaChip = ({ value, direction }: DeltaChipProps) => {
  const isDown = direction === 'down'
  const Icon = isDown ? ArrowDownRight : ArrowUpRight

  return (
    <Box display="flex" alignItems="center" columnGap="m">
      <Box
        width={20}
        height={20}
        backgroundColor={isDown ? 'background-danger' : 'background-inverse'}
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
