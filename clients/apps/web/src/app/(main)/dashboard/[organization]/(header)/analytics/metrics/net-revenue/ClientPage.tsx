'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useMetrics } from '@/hooks/queries'
import { fromISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns/subMonths'
import { useMemo } from 'react'
import { MetricGroup } from '../components/MetricGroup'
import { MetricsHeader } from '../components/MetricsHeader'
import { MetricsSubNav } from '../components/MetricsSubNav'

interface ClientPageProps {
  organization: schemas['Organization']
  earliestDateISOString: string
  startDateISOString?: string
  endDateISOString?: string
  interval: schemas['TimeInterval']
  productId?: string[]
  hasRecurringProducts: boolean
  hasOneTimeProducts: boolean
}

export default function ClientPage({
  organization,
  earliestDateISOString,
  startDateISOString,
  endDateISOString,
  interval,
  productId,
  hasRecurringProducts,
  hasOneTimeProducts,
}: ClientPageProps) {
  const [startDate, endDate] = useMemo(() => {
    const today = new Date()
    const startDate = startDateISOString
      ? fromISODate(startDateISOString)
      : subMonths(today, 1)
    const endDate = endDateISOString ? fromISODate(endDateISOString) : today
    return [startDate, endDate]
  }, [startDateISOString, endDateISOString])

  const netRevenueMetrics = useMemo(() => {
    const baseMetrics: (keyof schemas['Metrics'])[] = [
      'net_revenue',
      'net_average_order_value',
      'net_cumulative_revenue',
    ]
    const subscriptionNetMetrics: (keyof schemas['Metrics'])[] = [
      'new_subscriptions_net_revenue',
      'renewed_subscriptions_net_revenue',
    ]
    const oneTimeNetMetrics: (keyof schemas['Metrics'])[] = [
      'one_time_products_net_revenue',
    ]

    return [
      ...baseMetrics,
      ...(hasRecurringProducts ? subscriptionNetMetrics : []),
      ...(hasOneTimeProducts ? oneTimeNetMetrics : []),
    ]
  }, [hasRecurringProducts, hasOneTimeProducts])

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organization.id,
    ...(productId ? { product_id: productId } : {}),
    metrics: netRevenueMetrics,
  })

  return (
    <DashboardBody
      wide
      title={<MetricsSubNav />}
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
      <div className="flex flex-col gap-12">
        {data && (
          <MetricGroup
            title="Net Revenue"
            metricKeys={netRevenueMetrics}
            data={data}
            interval={interval}
          />
        )}
      </div>
    </DashboardBody>
  )
}
