'use client'

import { useMetrics } from '@/hooks/queries/metrics'
import { fromISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import MetricChartBox from '../Metrics/MetricChartBox'

interface MetricToolResultProps {
  metrics: string[]
  startDate: string
  endDate: string
  interval: schemas['TimeInterval']
  organizationId: string
}

export function MetricToolResult({
  metrics,
  startDate,
  endDate,
  interval,
  organizationId,
}: MetricToolResultProps) {
  const { data, isLoading } = useMetrics({
    startDate: fromISODate(startDate),
    endDate: fromISODate(endDate),
    interval,
    organization_id: organizationId,
    metrics,
  })

  return (
    <div className="flex flex-col gap-3 py-2">
      {metrics.map((metric) => (
        <MetricChartBox
          key={metric}
          metric={metric as keyof schemas['Metrics']}
          data={data}
          interval={interval}
          height={200}
          loading={isLoading}
          compact
          simple
        />
      ))}
    </div>
  )
}
