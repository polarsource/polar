'use client'

import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricPeriod, ParsedMetricsResponse } from '@/hooks/queries'
import { METRIC_GROUPS } from '@/utils/metrics'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRef, useState } from 'react'
import { VoidReducerMetric } from './identityLive'

const CHART_CLASS =
  'rounded-none! bg-transparent dark:bg-transparent dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none'

const METRIC_TITLES = new Map<string, string>(
  METRIC_GROUPS.flatMap((group) =>
    group.metrics.map((metric) => [metric.slug, metric.display_name] as const),
  ),
)

function toChartData(metric: VoidReducerMetric): ParsedMetricsResponse {
  return {
    metrics: {
      orders: {
        slug: 'orders',
        display_name: METRIC_TITLES.get(metric.slug) ?? metric.slug,
        type: 'scalar',
      },
    },
    totals: { orders: metric.total ?? 0 },
    periods: metric.periods.map((period) => ({
      timestamp: new Date(period.timestamp),
      orders: period.value ?? 0,
    })) as ParsedMetricPeriod[],
  }
}

interface VoidReducerMetricsProps {
  metrics: VoidReducerMetric[]
}

export function VoidReducerMetrics({ metrics }: VoidReducerMetricsProps) {
  const remainingMetrics = new Map(
    metrics.map((metric) => [metric.slug, metric]),
  )
  const groups = METRIC_GROUPS.map((group) => ({
    title: group.category,
    metrics: group.metrics.flatMap(({ slug }) => {
      const metric = remainingMetrics.get(slug)
      if (!metric) return []
      remainingMetrics.delete(slug)
      return [metric]
    }),
  }))

  return (
    <Box flexDirection="column" rowGap="3xl">
      {[
        {
          title: 'Reducer based metrics',
          metrics: [...remainingMetrics.values()],
        },
        ...groups,
      ]
        .filter((group) => group.metrics.length > 0)
        .map((group) => (
          <Box
            key={group.title}
            as="section"
            flexDirection="column"
            rowGap="xl"
          >
            <Text as="h2" variant="heading-xs">
              {group.title}
            </Text>
            <VoidReducerMetricGroup metrics={group.metrics} />
          </Box>
        ))}
    </Box>
  )
}

function VoidReducerMetricGroup({ metrics }: VoidReducerMetricsProps) {
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<number | null>(
    null,
  )
  const activeHoverKey = useRef<string | null>(null)

  const onHoverPeriodChange = (id: string, period: number | null) => {
    if (period !== null) {
      activeHoverKey.current = id
      setHoveredPeriodIndex(period)
      return
    }
    if (activeHoverKey.current === id) {
      activeHoverKey.current = null
      setHoveredPeriodIndex(null)
    }
  }

  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        display="grid"
        gridTemplateColumns={{
          base: '1fr',
          lg: 'repeat(2, 1fr)',
          xl: 'repeat(3, 1fr)',
        }}
      >
        {metrics.map((metric) => (
          <MetricChartBox
            key={metric.id}
            data={toChartData(metric)}
            interval="day"
            metric="orders"
            height={200}
            chartType="line"
            shareable={false}
            exportable={false}
            hoveredPeriodIndex={hoveredPeriodIndex}
            onHoverPeriodChange={(period) =>
              onHoverPeriodChange(metric.id, period)
            }
            className={CHART_CLASS}
          />
        ))}
      </Box>
    </Box>
  )
}
