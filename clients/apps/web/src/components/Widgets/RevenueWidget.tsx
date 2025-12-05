import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import { Card } from '@polar-sh/ui/components/atoms/Card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import Spinner from '../Shared/Spinner'

interface RevenueWidgetProps {
  className?: string
  productId?: string
}

const RevenueWidget = ({ className, productId }: RevenueWidgetProps) => {
  const { organization } = useContext(OrganizationContext)

  const revenueMetrics = useMetrics({
    startDate: startOfMonth(subMonths(new Date(), 5)),
    endDate: endOfMonth(new Date()),
    organization_id: organization.id,
    interval: 'month',
    product_id: productId ? [productId] : undefined,
    metrics: ['revenue'],
  })

  const maxRevenue = Math.max(
    ...(revenueMetrics.data?.periods.map((period) => period.revenue ?? 0) ??
      []),
  )

  return (
    <Card
      className={twMerge(
        'dark:bg-polar-800 flex h-full w-full flex-col gap-y-8 bg-gray-50 p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <h2 className="dark:text-polar-500 text-lg text-gray-500">
            Last 6 Months
          </h2>
        </div>

        <h3 className="text-4xl font-light">
          {productId ? 'Product Revenue' : 'Revenue'}
        </h3>
      </div>

      <div className="grid h-full grid-cols-3 gap-4 lg:grid-cols-6 lg:gap-6">
        {revenueMetrics.data?.periods.map((period, index, array) => {
          const currentPeriodValue = period.revenue ?? 0
          const previousPeriodValue = array[index - 1]?.revenue ?? 0

          const percentageChangeComparedToPreviousPeriod =
            previousPeriodValue === 0 && currentPeriodValue === 0
              ? 0
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
              <Tooltip>
                <TooltipTrigger className="relative h-full min-h-48 overflow-hidden rounded-2xl bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.05),rgba(0,0,0,0.05)_2px,transparent_2px,transparent_8px)] dark:bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03)_2px,transparent_2px,transparent_8px)]">
                  {revenueMetrics.isLoading ? (
                    <div className="dark:bg-polar-700 flex h-full w-full items-center justify-center rounded-2xl bg-gray-200">
                      <Spinner />
                    </div>
                  ) : (
                    <div
                      className={twMerge(
                        'absolute bottom-0 w-full rounded-2xl',
                        index === array.length - 1
                          ? 'bg-indigo-300 dark:bg-indigo-500'
                          : 'dark:bg-polar-600 bg-gray-300',
                      )}
                      style={{
                        height: `${((period.revenue ?? 0) / maxRevenue) * 100}%`,
                      }}
                    />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <span>
                    {formatCurrencyAndAmount(period.revenue ?? 0, 'usd', 0)} in{' '}
                    {format(period.timestamp, 'MMMM')}
                  </span>
                </TooltipContent>
              </Tooltip>
              <div className="flex flex-col text-left">
                <span className="text-sm lg:text-base">
                  {format(period.timestamp, 'MMMM')}
                </span>
                <div className="flex flex-row items-center justify-between gap-x-2">
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    $
                    {((period.revenue ?? 0) / 100).toLocaleString('en-US', {
                      style: 'decimal',
                      compactDisplay: 'short',
                      notation: 'compact',
                    })}
                  </span>
                  {!isTrendFlat ? (
                    <Tooltip>
                      <TooltipTrigger
                        className={twMerge(
                          'flex flex-row items-center gap-x-1 rounded-xs p-0.5 text-xs',
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
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-xs">
                          {percentageChangeComparedToPreviousPeriod === Infinity
                            ? 'Infinity'
                            : percentageChangeComparedToPreviousPeriod.toFixed(
                                0,
                              ) + '%'}
                        </span>
                      </TooltipContent>
                    </Tooltip>
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

export default RevenueWidget
