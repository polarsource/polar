'use client'

import { SubscriptionMetricsTaxAlert } from '@/components/Metrics/SubscriptionMetricsTaxAlert'
import { useMetrics } from '@/hooks/queries'
import { fromISODate, METRIC_GROUPS, toISODate } from '@/utils/metrics'
import { getMetricsRangeDates, type schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useMemo } from 'react'
import { CancellationsContent } from './CancellationsContent'
import { MetricGroup } from './MetricGroup'
import { SeatsContent } from './SeatsContent'

const TIME_INTERVALS = ['hour', 'day', 'week', 'month', 'year'] as const

const parseAsISODate = createParser({
  parse: (value) => {
    if (!value) return null
    const date = fromISODate(value)
    return isNaN(date.getTime()) ? null : date
  },
  serialize: (date) => toISODate(date),
})

interface ClientPageProps {
  metric: string
  organization: schemas['Organization']
}

export default function ClientPage({ metric, organization }: ClientPageProps) {
  const organizationId = organization.id

  const [defaultStartDate, defaultEndDate] = useMemo(
    () => getMetricsRangeDates('30d'),
    [],
  )

  const [interval] = useQueryState(
    'interval',
    parseAsStringLiteral(TIME_INTERVALS).withDefault('day'),
  )

  const [startDate] = useQueryState(
    'start_date',
    parseAsISODate.withDefault(defaultStartDate),
  )

  const [endDate] = useQueryState(
    'end_date',
    parseAsISODate.withDefault(defaultEndDate),
  )

  const [productId] = useQueryState('product_id', parseAsArrayOf(parseAsString))

  const metrics = useMemo(() => {
    const group = METRIC_GROUPS.find(
      (g) => g.category.toLowerCase().replace(/\s+/g, '-') === metric,
    )
    return group ? group.metrics.map((m) => m.slug) : []
  }, [metric])

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organizationId,
    ...(productId && productId.length > 0 ? { product_id: productId } : {}),
    metrics,
  })

  if (!data) {
    return null
  }

  return (
    <Box flexDirection="column" rowGap="3xl">
      {metric === 'subscriptions' && (
        <SubscriptionMetricsTaxAlert organization={organization} />
      )}
      {metric === 'cancellations' ? (
        <CancellationsContent
          data={data}
          interval={interval}
          organizationId={organizationId}
          startDate={startDate}
          endDate={endDate}
          productId={productId ?? undefined}
        />
      ) : metric === 'seats' ? (
        <SeatsContent data={data} interval={interval} />
      ) : (
        <MetricGroup metricKeys={metrics} data={data} interval={interval} />
      )}
    </Box>
  )
}
