'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ParsedMetricsResponse, useMetrics } from '@/hooks/queries'
import { fromISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns/subMonths'
import { ReactNode, useMemo } from 'react'
import { MetricGroup } from './MetricGroup'
import { MetricsHeader } from './MetricsHeader'
import { MetricsSubNav } from './MetricsSubNav'

export interface MetricsPageProps {
  organization: schemas['Organization']
  earliestDateISOString: string
  startDateISOString?: string
  endDateISOString?: string
  interval: schemas['TimeInterval']
  productId?: string[]
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
  organization,
  earliestDateISOString,
  startDateISOString,
  endDateISOString,
  interval,
  productId,
  hasRecurringProducts,
  hasOneTimeProducts,
  metrics,
  children,
}: MetricsPageComponentProps) {
  const [startDate, endDate] = useMemo(() => {
    const today = new Date()
    const startDate = startDateISOString
      ? fromISODate(startDateISOString)
      : subMonths(today, 1)
    const endDate = endDateISOString ? fromISODate(endDateISOString) : today
    return [startDate, endDate]
  }, [startDateISOString, endDateISOString])

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organization.id,
    ...(productId ? { product_id: productId } : {}),
    metrics,
  })

  return (
    <DashboardBody
      wide
      header={
        <MetricsHeader
          organization={organization}
          earliestDateISOString={earliestDateISOString}
          startDateISOString={startDateISOString}
          endDateISOString={endDateISOString}
          interval={interval}
          productId={productId}
        />
      }
    >
      <div className="mb-7">
        <MetricsSubNav
          organization={organization}
          hasRecurringProducts={hasRecurringProducts}
          hasOneTimeProducts={hasOneTimeProducts}
        />
      </div>

      <div className="flex flex-col gap-12">
        {data &&
          (children ? (
            children(data, interval)
          ) : (
            <MetricGroup metricKeys={metrics} data={data} interval={interval} />
          ))}
      </div>
    </DashboardBody>
  )
}
