'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { BarcodeChart } from './BarcodeChart'
import { VoidCell } from './VoidGrid'

export const VoidMetricCell = ({
  label,
  value,
  series,
}: {
  label: string
  value: string
  series: number[]
}) => (
  <VoidCell minHeight={200}>
    <Box
      flexDirection="column"
      justifyContent="between"
      flexGrow={1}
      rowGap="2xl"
    >
      <Text variant="heading-xxs">{label}</Text>
      <Box flexDirection="column" rowGap="l">
        <Text variant="heading-l" truncate>
          {value}
        </Text>
        {series.some((point) => point !== 0) ? (
          <BarcodeChart values={series} height={28} barWidth={2} />
        ) : (
          <Box height={28} />
        )}
      </Box>
    </Box>
  </VoidCell>
)
