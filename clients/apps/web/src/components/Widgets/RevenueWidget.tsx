import { useMetrics } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { getCentsInDollarString } from '@polarkit/lib/money'
import { Card, CardFooter, CardHeader } from 'polarkit/components/ui/atoms/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'polarkit/components/ui/tooltip'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

export interface RevenueWidgetProps {
  className?: string
}

export const RevenueWidget = ({ className }: RevenueWidgetProps) => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - 1)

  const revenueMetrics = useMetrics({
    organizationId: org.id,
    interval: 'month',
    startDate,
    endDate: new Date(),
  })

  const maxPeriod =
    revenueMetrics.data?.periods.reduce(
      (acc, curr) => (curr.revenue > acc ? curr.revenue : acc),
      0,
    ) ?? 0

  return (
    <Card className={twMerge('flex h-80 flex-col justify-between', className)}>
      <CardHeader className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">Revenue</span>
          <span className="dark:text-polar-500 text-gray-400">
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
        <h2 className="text-xl">
          $
          {getCentsInDollarString(
            revenueMetrics.data?.periods[
              revenueMetrics.data?.periods.length - 1
            ].revenue ?? 0,
            false,
          )}
        </h2>
      </CardHeader>
      <TooltipProvider>
        <CardFooter className="flex h-full flex-row items-end justify-between gap-x-1">
          {revenueMetrics.data?.periods.map((period, i) => {
            const activeClass =
              i === revenueMetrics.data.periods.length - 1
                ? 'bg-blue-500 dark:bg-blue-500'
                : 'hover:bg-blue-100 dark:hover:bg-blue-900'

            const tooltipContent = `$${getCentsInDollarString(period.revenue, false)} in ${period.timestamp.toLocaleDateString(
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
                      (period.revenue / maxPeriod) * 100 || 0,
                      8,
                    )}%`,
                  }}
                  className={twMerge(
                    'dark:bg-polar-700 w-3 flex-shrink rounded-full bg-gray-100',
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
