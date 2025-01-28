import { useMetrics } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  Card,
  CardFooter,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

export interface SubscribersWidgetProps {
  className?: string
}

export const SubscribersWidget = ({ className }: SubscribersWidgetProps) => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - 1)

  const subscriberMetrics = useMetrics({
    organizationId: org.id,
    interval: 'month',
    startDate,
    endDate: new Date(),
  })

  const maxPeriod =
    subscriberMetrics.data?.periods.reduce(
      (acc, curr) =>
        curr.active_subscriptions > acc ? curr.active_subscriptions : acc,
      0,
    ) ?? 0

  return (
    <Card className={twMerge('flex h-80 flex-col justify-between', className)}>
      <CardHeader className="flex flex-col gap-y-1 pb-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">
            Active Subscriptions
          </span>
        </div>
        <h2 className="text-xl">
          {
            subscriberMetrics.data?.periods[
              subscriberMetrics.data?.periods.length - 1
            ].active_subscriptions
          }
        </h2>
      </CardHeader>
      <TooltipProvider>
        <CardFooter className="dark:bg-polar-900 m-2 flex h-full flex-row items-end justify-between gap-x-1 rounded-3xl bg-white p-4">
          {subscriberMetrics.data?.periods.map((period, i) => {
            const activeClass =
              i === subscriberMetrics.data.periods.length - 1
                ? 'bg-blue-500 dark:bg-blue-500'
                : 'hover:bg-blue-100 dark:hover:bg-blue-900'

            const tooltipContent = `${period.active_subscriptions} in ${period.timestamp.toLocaleDateString(
              'en-US',
              {
                month: 'long',
                year: 'numeric',
              },
            )}`

            return (
              <Tooltip key={i} delayDuration={0}>
                <TooltipTrigger
                  style={{
                    height: `${Math.max(
                      (period.active_subscriptions / maxPeriod) * 100 || 0,
                      8,
                    )}%`,
                  }}
                  className={twMerge(
                    'dark:bg-polar-600 w-3 flex-shrink rounded-full bg-gray-300',
                    activeClass,
                  )}
                />
                <TooltipContent className="text-sm">
                  {tooltipContent}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </CardFooter>
      </TooltipProvider>
    </Card>
  )
}
