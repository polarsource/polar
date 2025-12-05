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
}

const SUBSCRIPTION_METRICS: (keyof schemas['Metrics'])[] = [
  'monthly_recurring_revenue',
  'committed_monthly_recurring_revenue',
  'active_subscriptions',
  'new_subscriptions',
  'renewed_subscriptions',
  'average_revenue_per_user',
  'ltv',
  'new_subscriptions_revenue',
  'renewed_subscriptions_revenue',
]

export default function ClientPage({
  organization,
  earliestDateISOString,
  startDateISOString,
  endDateISOString,
  interval,
  productId,
}: ClientPageProps) {
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
    metrics: SUBSCRIPTION_METRICS,
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
            title="Subscriptions"
            metricKeys={SUBSCRIPTION_METRICS}
            data={data}
            interval={interval}
          />
        )}
      </div>
    </DashboardBody>
  )
}
