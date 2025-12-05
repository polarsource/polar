'use client'

import { ParsedMetricsResponse, useMetrics } from '@/hooks/queries'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns/subMonths'
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { ReactNode, useMemo } from 'react'
import { MetricGroup } from './MetricGroup'

const TIME_INTERVALS = ['hour', 'day', 'week', 'month', 'year'] as const

const parseAsISODate = createParser({
  parse: (value) => {
    if (!value) return null
    const date = fromISODate(value)
    return isNaN(date.getTime()) ? null : date
  },
  serialize: (date) => toISODate(date),
})

export interface MetricsPageProps {
  organizationId: string
  hasRecurringProducts: boolean
  hasOneTimeProducts: boolean
}

interface MetricsPageComponentProps extends MetricsPageProps {
  metrics: (keyof schemas['Metrics'])[]
  children?: (
    data: ParsedMetricsResponse,
    interval: schemas['TimeInterval'],
  ) => ReactNode
}

export function MetricsPage({
  organizationId,
  metrics,
  children,
}: MetricsPageComponentProps) {
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

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organizationId,
    ...(productId && productId.length > 0 ? { product_id: productId } : {}),
    metrics,
  })

  return (
    <div className="flex flex-col gap-12">
      {data &&
        (children ? (
          children(data, interval)
        ) : (
          <MetricGroup metricKeys={metrics} data={data} interval={interval} />
        ))}
    </div>
  )
}
