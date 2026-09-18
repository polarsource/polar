'use client'

import {
  GenericChart,
  GenericChartReferenceLine,
  GenericChartSeries,
} from '@/components/Charts/GenericChart'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import { useMemo } from 'react'
import { VoidConfigSignal } from './api'
import { useSeriesColors } from './Simulation/ScenarioChart'
import { shortDate } from './Simulation/format'
import { LegendSwatch } from './Simulation/SeriesLegend'
import { describeHysteresis, formatMeterValue, formatNoul } from './signals'

/** Illustrative series normalised to [0, 1], oldest first. 1 is the side that enters. */
const SHAPE = (() => {
  const raw = [
    0.12, 0.18, 0.3, 0.42, 0.58, 0.76, 0.88, 0.82, 0.66, 0.54, 0.6, 0.72, 0.5,
    0.36, 0.22, 0.3, 0.46, 0.6, 0.5, 0.4, 0.28, 0.16,
  ]
  const min = Math.min(...raw)
  const max = Math.max(...raw)
  return raw.map((value) => (value - min) / (max - min))
})()

interface Point extends Record<string, unknown> {
  timestamp: string
  value: number
}

interface Model {
  valueLabel: string
  enter: number
  exit: number
  /** Whether the signal enters when the value is low (meter) or high (semantic). */
  entersLow: boolean
  format: (value: number) => string
}

const modelFor = (signal: VoidConfigSignal): Model =>
  signal.kind === 'semantic'
    ? {
        valueLabel: 'Noul',
        enter: signal.enter_above,
        exit: signal.exit_below,
        entersLow: false,
        format: formatNoul,
      }
    : {
        valueLabel: 'Remaining',
        enter: signal.enter_below,
        exit: signal.exit_at_least,
        entersLow: true,
        format: formatMeterValue,
      }

const points = (model: Model): Point[] => {
  const low = (model.entersLow ? model.enter : model.exit) * 0.5
  const high = model.entersLow
    ? model.exit * 1.4
    : Math.min(model.enter * 1.25, 1)
  const today = new Date()
  return SHAPE.map((unit, index) => ({
    timestamp: subDays(today, SHAPE.length - 1 - index).toISOString(),
    value: low + (model.entersLow ? 1 - unit : unit) * (high - low),
  }))
}

export const VoidSignalHysteresis = ({
  signal,
}: {
  signal: VoidConfigSignal
}) => {
  const colors = useSeriesColors()
  const model = useMemo(() => modelFor(signal), [signal])
  const data = useMemo(() => points(model), [model])
  const series = useMemo<GenericChartSeries[]>(
    () => [{ key: 'value', label: model.valueLabel, color: colors.scenario }],
    [model, colors],
  )
  const thresholds = useMemo<GenericChartReferenceLine[]>(
    () => [
      {
        y: model.enter,
        label: `Enters ${model.format(model.enter)}`,
        color: colors.reference,
      },
      {
        y: model.exit,
        label: `Exits ${model.format(model.exit)}`,
        color: colors.reference,
      },
    ],
    [model, colors],
  )

  return (
    <Box
      flexDirection="column"
      rowGap="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      padding="l"
    >
      <Box alignItems="center" columnGap="s">
        <LegendSwatch color={colors.scenario} />
        <Text color="muted" variant="caption">
          {model.valueLabel}, illustrative
        </Text>
      </Box>
      <GenericChart
        data={data}
        series={series}
        xAxisKey="timestamp"
        xAxisFormatter={shortDate}
        valueFormatter={(value) => model.format(value)}
        height={240}
        chartType="line"
        referenceLines={thresholds}
      />
      <Text color="muted" variant="caption">
        {describeHysteresis(signal)}
      </Text>
    </Box>
  )
}
