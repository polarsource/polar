'use client'

import { Box } from '@polar-sh/orbit/Box'

interface BarcodeChartProps {
  values: number[]
  height?: number
  barWidth?: number
}

export const BarcodeChart = ({
  values,
  height = 140,
  barWidth = 3,
}: BarcodeChartProps) => {
  const max = Math.max(...values, 1)

  return (
    <Box height={height} width="100%" alignItems="end" justifyContent="between">
      {values.map((value, index) => (
        <Box
          key={index}
          width={barWidth}
          height={Math.max(Math.round((value / max) * height), 2)}
          backgroundColor="background-inverse"
          opacity={value > 0 ? 1 : 0.15}
        />
      ))}
    </Box>
  )
}
