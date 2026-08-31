'use client'

import { useMeterQuantities } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { BarcodeChart } from './BarcodeChart'
import { VoidCell } from './VoidGrid'

interface VoidMeterCellProps {
  meter: schemas['Meter']
  startDate: Date
  endDate: Date
}

export const VoidMeterCell = ({
  meter,
  startDate,
  endDate,
}: VoidMeterCellProps) => {
  const { data } = useMeterQuantities(meter.id, {
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    interval: 'day',
  })

  const quantities = useMemo(
    () => data?.quantities.map((quantity) => quantity.quantity) ?? [],
    [data],
  )
  const total = useMemo(
    () => quantities.reduce((sum, quantity) => sum + quantity, 0),
    [quantities],
  )

  return (
    <VoidCell minHeight={280}>
      <Box
        flexDirection="column"
        justifyContent="between"
        flexGrow={1}
        rowGap="3xl"
      >
        <Box flexDirection="column" rowGap="s">
          <Text variant="heading-xxs" color="muted">
            {`${meter.aggregation.func} / ${meter.id.slice(0, 8)}`}
          </Text>
          <Text variant="heading-m">{meter.name}</Text>
        </Box>
        <Box flexDirection="column" rowGap="l">
          <Text variant="heading-xl">{total.toLocaleString('en-US')}</Text>
          {quantities.length > 0 ? (
            <BarcodeChart values={quantities} height={40} barWidth={2} />
          ) : null}
        </Box>
      </Box>
    </VoidCell>
  )
}
