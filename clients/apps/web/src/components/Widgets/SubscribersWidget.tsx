import { useMetrics } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Card, CardFooter, CardHeader } from 'polarkit/components/ui/atoms/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'polarkit/components/ui/tooltip'
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
      <CardHeader className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">
            Active Subscriptions
          </span>
          <span className="dark:text-polar-500 text-gray-400">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
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
        <CardFooter className="flex h-full flex-row items-end justify-between">
          {subscriberMetrics.data?.periods.map((period, i) => {
            const activeClass =
              i === subscriberMetrics.data.periods.length - 1
                ? 'bg-blue-400 dark:bg-blue-400'
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
                    'dark:bg-polar-700 w-3 rounded-full bg-gray-100',
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
