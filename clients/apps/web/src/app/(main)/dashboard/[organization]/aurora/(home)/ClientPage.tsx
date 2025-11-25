'use client'

import { DashboardBody } from '@/components/Aurora/DashboardBody'
import { useMetrics } from '@/hooks/queries'
import { formatHumanFriendlyCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: metricsData } = useMetrics({
    organization_id: organization.id,
    startDate: startOfMonth(subMonths(new Date(), 1)),
    endDate: endOfMonth(new Date()),
    interval: 'day',
  })

  return (
    <DashboardBody className="dark:divide-polar-700 gap-y-12 divide-y divide-gray-200">
      <section className="flex flex-col gap-y-12 p-24">
        <h3 className="text-2xl">Revenue</h3>
        <h1 className="font-mono text-9xl font-thin">
          {formatHumanFriendlyCurrency(metricsData?.totals.revenue ?? 0)}
        </h1>
      </section>
      <section className="flex flex-col gap-y-12 p-24">
        <h3 className="text-2xl">Profit</h3>
        <h1 className="font-mono text-9xl font-thin">
          {formatHumanFriendlyCurrency(metricsData?.totals.gross_margin ?? 0)}
        </h1>
      </section>
    </DashboardBody>
  )
}
