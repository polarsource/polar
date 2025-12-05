'use client'

import CancellationsDistributionChart from '@/components/Metrics/CancellationsDistributionChart'
import CancellationsStackedChart from '@/components/Metrics/CancellationsStackedChart'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { schemas } from '@polar-sh/client'
import { MetricsPage, MetricsPageProps } from '../components/MetricsPage'

const CANCELLATION_CHART_METRICS: (keyof schemas['Metrics'])[] = [
  'canceled_subscriptions',
  'churned_subscriptions',
  'churn_rate',
]

const ALL_CANCELLATION_METRICS: (keyof schemas['Metrics'])[] = [
  ...CANCELLATION_CHART_METRICS,
  'canceled_subscriptions_too_expensive',
  'canceled_subscriptions_missing_features',
  'canceled_subscriptions_switched_service',
  'canceled_subscriptions_unused',
  'canceled_subscriptions_customer_service',
  'canceled_subscriptions_low_quality',
  'canceled_subscriptions_too_complex',
  'canceled_subscriptions_other',
]

export default function ClientPage(props: MetricsPageProps) {
  return (
    <MetricsPage
      {...props}
      metrics={ALL_CANCELLATION_METRICS}
      title="Cancellations"
    >
      {(data, interval) => (
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
      )}
    </MetricsPage>
  )
}
