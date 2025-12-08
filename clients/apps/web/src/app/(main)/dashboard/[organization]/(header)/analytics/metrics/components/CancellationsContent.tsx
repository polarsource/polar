'use client'

import CancellationsDistributionChart from '@/components/Metrics/CancellationsDistributionChart'
import CancellationsStackedChart from '@/components/Metrics/CancellationsStackedChart'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { ParsedMetricsResponse } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { CANCELLATION_CHART_METRICS } from './metrics-config'

interface CancellationsContentProps {
  data: ParsedMetricsResponse
  interval: schemas['TimeInterval']
}

export function CancellationsContent({
  data,
  interval,
}: CancellationsContentProps) {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] md:grid-cols-2 lg:grid-cols-3">
          <div className="dark:border-polar-700 col-span-2 border-t-0 border-r border-b border-l-0 border-gray-200 p-4">
            <CancellationsStackedChart
              data={data}
              interval={interval}
              height={400}
            />
          </div>
          <div className="dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 p-4">
            <CancellationsDistributionChart
              data={data}
              interval={interval}
              height={20}
            />
          </div>
          {CANCELLATION_CHART_METRICS.map((metricKey) => (
            <MetricChartBox
              key={metricKey}
              data={data}
              interval={interval}
              metric={metricKey}
              height={200}
              chartType="line"
              className="dark:border-polar-700 rounded-none! border-t-0 border-r border-b border-l-0 border-gray-200 bg-transparent shadow-none dark:bg-transparent"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
