import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DeltaChip, type DeltaChipProps } from './DeltaChip'
import React from 'react'

export type MetricCardProps = {
  label: string
  value: string
  delta?: DeltaChipProps
  trailing?: React.ReactNode
}

export const MetricCard = ({
  label,
  value,
  delta,
  trailing,
}: MetricCardProps) => {
  return (
    <Box
      backgroundColor="background-card"
      padding="2xl"
      display="flex"
      flexDirection="column"
      justifyContent="between"
      minHeight={320}
    >
      <Box display="flex" flexDirection="column" rowGap="xl">
        <Box
          display="flex"
          alignItems="center"
          justifyContent="between"
          columnGap="m"
        >
          <Text variant="heading-xs" color="default">
            {label}
          </Text>
          {delta && <DeltaChip {...delta} />}
          {trailing}
        </Box>
        <Box
          width={24}
          borderTopWidth={2}
          borderStyle="solid"
          borderColor="border-primary"
        />
      </Box>

      <Text as="span" variant="heading-xl" color="default" wrap="nowrap">
        {value}
      </Text>
    </Box>
  )
}
