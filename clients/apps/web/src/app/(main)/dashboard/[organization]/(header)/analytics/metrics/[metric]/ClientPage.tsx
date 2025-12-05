'use client'

import { useMemo } from 'react'
import { CancellationsContent } from '../components/CancellationsContent'
import {
  CANCELLATION_METRICS,
  getMetricsForType,
  MetricType,
} from '../components/metrics-config'
import { MetricsPage, MetricsPageProps } from '../components/MetricsPage'

interface ClientPageProps extends MetricsPageProps {
  metric: MetricType
}

export default function ClientPage({
  metric,
  hasRecurringProducts,
  hasOneTimeProducts,
  ...props
}: ClientPageProps) {
  const metrics = useMemo(
    () =>
      getMetricsForType(metric, {
        hasRecurringProducts,
        hasOneTimeProducts,
      }),
    [metric, hasRecurringProducts, hasOneTimeProducts],
  )

  if (metric === 'cancellations') {
    return (
      <MetricsPage
        {...props}
        hasRecurringProducts={hasRecurringProducts}
        hasOneTimeProducts={hasOneTimeProducts}
        metrics={CANCELLATION_METRICS}
      >
        {(data, interval) => (
          <CancellationsContent data={data} interval={interval} />
        )}
      </MetricsPage>
    )
  }

  return (
    <MetricsPage
      {...props}
      hasRecurringProducts={hasRecurringProducts}
      hasOneTimeProducts={hasOneTimeProducts}
      metrics={metrics}
    />
  )
}
