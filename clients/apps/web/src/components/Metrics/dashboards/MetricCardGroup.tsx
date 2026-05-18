'use client'

import { MetricCard } from '@/components/Metrics/MetricCard'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { getFormattedMetricValue, INVERTED_METRICS } from '@/utils/metrics'
import { Box } from '@polar-sh/orbit/Box'
import { schemas } from '@polar-sh/client'
import type { DeltaChipProps } from '../DeltaChip'

interface MetricCardGroupProps {
  data?: ParsedMetricsResponse
  previousData?: ParsedMetricsResponse
  metricKeys: (keyof schemas['Metrics'])[]
  loading?: boolean
}

const computeDelta = (
  current: number,
  previous: number,
  inverted: boolean,
): DeltaChipProps | undefined => {
  if (!Number.isFinite(previous) || previous === 0) return undefined
  if (!Number.isFinite(current)) return undefined
  const change = ((current - previous) / previous) * 100
  if (!Number.isFinite(change) || change === 0) return undefined
  const direction: DeltaChipProps['direction'] = change >= 0 ? 'up' : 'down'
  const isGoodChange = inverted ? change < 0 : change > 0
  const sentiment: DeltaChipProps['sentiment'] = isGoodChange
    ? 'positive'
    : 'negative'
  return {
    value: Math.abs(Math.round(change)),
    direction,
    sentiment,
  }
}

export function MetricCardGroup({
  metricKeys,
  data,
  previousData,
  loading,
}: MetricCardGroupProps) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: '1fr',
        sm: 'repeat(2, 1fr)',
        lg: 'repeat(3, 1fr)',
      }}
      gap="xl"
    >
      {metricKeys.map((metricKey) => {
        const meta = data?.metrics[metricKey]
        const total = data?.totals[metricKey] ?? 0
        const previousTotal = previousData?.totals[metricKey] ?? 0
        const value = meta ? getFormattedMetricValue(meta, total) : ''
        const delta = previousData
          ? computeDelta(total, previousTotal, INVERTED_METRICS.has(metricKey))
          : undefined
        return (
          <MetricCard
            key={String(metricKey)}
            label={meta?.display_name ?? ''}
            value={String(value)}
            delta={delta}
            loading={loading}
          />
        )
      })}
    </Box>
  )
}
