'use client'

import { useMetrics } from '@/hooks/queries'
import { fromISODate, toISODate } from '@/utils/metrics'
import { subMonths } from 'date-fns/subMonths'
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useMemo } from 'react'
import { CancellationsContent } from '../components/CancellationsContent'
import { MetricGroup } from '../components/MetricGroup'
import {
  CANCELLATION_METRICS,
  getMetricsForType,
  MetricType,
} from '../components/metrics-config'

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
  metric: MetricType
  organizationId: string
  hasRecurringProducts: boolean
  hasOneTimeProducts: boolean
}

export default function ClientPage({
  metric,
  organizationId,
  hasRecurringProducts,
  hasOneTimeProducts,
}: ClientPageProps) {
  const defaultStartDate = useMemo(() => subMonths(new Date(), 1), [])
  const defaultEndDate = useMemo(() => new Date(), [])

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

  const metrics = useMemo(
    () =>
      metric === 'cancellations'
        ? CANCELLATION_METRICS
        : getMetricsForType(metric, {
            hasRecurringProducts,
            hasOneTimeProducts,
          }),
    [metric, hasRecurringProducts, hasOneTimeProducts],
  )

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
    <div className="flex flex-col gap-12">
      {metric === 'cancellations' ? (
        <CancellationsContent data={data} interval={interval} />
      ) : (
        <MetricGroup metricKeys={metrics} data={data} interval={interval} />
      )}
    </div>
  )
}
