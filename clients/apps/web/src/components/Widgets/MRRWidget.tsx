import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useMetrics } from '@/hooks/queries'
import { getCentsInDollarString } from '@polarkit/lib/money'
import { Card, CardFooter, CardHeader } from 'polarkit/components/ui/atoms/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'polarkit/components/ui/tooltip'
import { twMerge } from 'tailwind-merge'

export interface MRRWidgetProps {
  className?: string
}

export const MRRWidget = ({ className }: MRRWidgetProps) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - 1)

  const revenueMetrics = useMetrics({
    organizationId: org?.id,
    interval: 'month',
    startDate,
    endDate: new Date(),
    productPriceType: 'recurring',
  })

  const maxPeriod =
    revenueMetrics.data?.periods.reduce(
      (acc, curr) =>
        curr.monthly_recurring_revenue > acc
          ? curr.monthly_recurring_revenue
          : acc,
      0,
    ) ?? 0

  return (
    <Card
      className={twMerge(
        'flex h-80 flex-col justify-between ring-1 ring-gray-100 dark:ring-transparent',
        className,
      )}
    >
      <CardHeader className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-400">MRR</span>
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
        <CardFooter className="flex h-full flex-row items-end justify-between">
          {revenueMetrics.data?.periods.map((period, i) => {
            const activeClass =
              i === revenueMetrics.data.periods.length - 1
                ? 'bg-blue-400 dark:bg-blue-400'
                : 'hover:bg-blue-100 dark:hover:bg-blue-900'

            const tooltipContent = `$${getCentsInDollarString(period.monthly_recurring_revenue, false)} in ${period.timestamp.toLocaleDateString(
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
                    height: `${Math.max((period.monthly_recurring_revenue / maxPeriod) * 100, 8)}%`,
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
