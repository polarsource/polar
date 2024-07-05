import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useMetrics } from '@/hooks/queries'
import { Card, CardFooter, CardHeader } from 'polarkit/components/ui/atoms/card'
import { twMerge } from 'tailwind-merge'
import MetricChart from '../Metrics/MetricChart'

export interface ActiveSubsWidgetProps {
  className?: string
}

export const ActiveSubsWidget = ({ className }: ActiveSubsWidgetProps) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 1)

  const metrics = useMetrics({
    organizationId: org?.id,
    interval: 'week',
    startDate,
    endDate: new Date(),
  })

  if (!metrics.data) {
    return null
  }

  return (
    <Card
      className={twMerge(
        'flex h-80 flex-col justify-between ring-1 ring-gray-100 dark:ring-transparent',
        className,
      )}
    >
      <CardHeader className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">Metrics</span>
          <span className="dark:text-polar-500 text-gray-400">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
        <h2 className="text-xl">Active Subscriptions</h2>
      </CardHeader>
      <CardFooter>
        <MetricChart
          metric={metrics.data.metrics.active_subscriptions}
          data={metrics.data.periods}
          interval="week"
        />
      </CardFooter>
    </Card>
  )
}
