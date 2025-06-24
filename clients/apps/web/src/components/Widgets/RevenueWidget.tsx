import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { Card } from '@polar-sh/ui/components/atoms/Card'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { useTheme } from 'next-themes'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import Spinner from '../Shared/Spinner'

interface CheckoutsWidgetProps {
  className?: string
}

const CheckoutsWidget = ({ className }: CheckoutsWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  const revenueMetrics = useMetrics({
    startDate: startOfMonth(subMonths(new Date(), 2)),
    endDate: endOfMonth(new Date()),
    organization_id: organization.id,
    interval: 'month',
  })

  const maxRevenue = Math.max(
    ...(revenueMetrics.data?.periods.map((period) => period.revenue) ?? []),
  )

  return (
    <Card
      className={twMerge(
        'dark:bg-polar-800 flex h-full w-full flex-col gap-y-6 bg-gray-50 p-6 md:gap-y-20',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Revenue</h2>
          <span className="dark:text-polar-500 text-gray-500">
            Last 3 Months
          </span>
        </div>
      </div>

      <div className="grid h-full grid-cols-1 gap-8 lg:grid-cols-3">
        {revenueMetrics.data?.periods.map((period, index, array) => {
          const currentPeriodValue = period.revenue ?? 0
          const previousPeriodValue = array[index - 1]?.revenue ?? 0

          const percentageChangeComparedToPreviousPeriod =
            previousPeriodValue === 0 && currentPeriodValue > 0
              ? 100 // If previous was 0 and current is positive, that's a 100% increase
              : previousPeriodValue === 0 && currentPeriodValue === 0
                ? 0 // If both are 0, there's no change
                : ((currentPeriodValue - previousPeriodValue) /
                    Math.abs(previousPeriodValue)) *
                  100

          const isTrendFlat = percentageChangeComparedToPreviousPeriod === 0

          const isTrendingUp = percentageChangeComparedToPreviousPeriod > 0

          return (
            <div
              key={period.timestamp}
              className="flex h-full flex-col gap-y-2"
            >
              <div
                className="relative h-full min-h-48 overflow-hidden rounded-2xl"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                45deg,
                ${isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)'},
                ${isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)'} 10px,
                transparent 10px,
                transparent 20px
              )`,
                }}
              >
                {revenueMetrics.isLoading ? (
                  <div className="dark:bg-polar-700 flex h-full w-full items-center justify-center rounded-2xl bg-gray-200">
                    <Spinner />
                  </div>
                ) : (
                  <div
                    className={twMerge(
                      'absolute bottom-0 w-full rounded-2xl bg-indigo-300 dark:bg-indigo-500',
                    )}
                    style={{
                      height: `${(period.revenue / maxRevenue) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex flex-col">
                <span>{format(period.timestamp, 'MMMM')}</span>
                <div className="flex flex-row items-center justify-between gap-x-2">
                  <span className="dark:text-polar-500 text-gray-500">
                    {formatCurrencyAndAmount(period.revenue, 'USD', 0)}
                  </span>
                  {!isTrendFlat ? (
                    <div
                      className={twMerge(
                        'flex flex-row items-center gap-x-1 rounded-sm px-1.5 py-0.5 text-xs',
                        isTrendingUp
                          ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                          : 'bg-red-100 text-red-500 dark:bg-red-950',
                      )}
                    >
                      {isTrendingUp ? (
                        <KeyboardArrowUp fontSize="inherit" />
                      ) : (
                        <KeyboardArrowDown fontSize="inherit" />
                      )}
                      <span className="text-xs">
                        {percentageChangeComparedToPreviousPeriod.toFixed(
                          percentageChangeComparedToPreviousPeriod % 1 === 0
                            ? 0
                            : 1,
                        )}
                        %
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default CheckoutsWidget
