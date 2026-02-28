import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import { formatCurrency } from '@polar-sh/currency'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import Spinner from '../Shared/Spinner'
import { WidgetContainer } from './WidgetContainer'

interface RevenueWidgetProps {
  className?: string
}

const RevenueWidget = ({ className }: RevenueWidgetProps) => {
  const { organization } = useContext(OrganizationContext)

  const revenueMetrics = useMetrics({
    startDate: startOfMonth(subMonths(new Date(), 2)),
    endDate: endOfMonth(new Date()),
    organization_id: organization.id,
    interval: 'month',
    metrics: ['revenue'],
  })

  const maxRevenue = Math.max(
    ...(revenueMetrics.data?.periods.map((period) => period.revenue ?? 0) ??
      []),
  )

  return (
    <WidgetContainer
      title="Revenue"
      action={
        <span className="dark:text-polar-500 text-gray-500">Last 3 Months</span>
      }
      className={className}
    >
      <div className="grid h-full grid-cols-3 gap-4">
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
                <TooltipTrigger className="relative h-full min-h-48 overflow-hidden rounded-lg bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.08),rgba(0,0,0,0.08)_2px,transparent_2px,transparent_8px)] dark:bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03)_2px,transparent_2px,transparent_8px)]">
                  {revenueMetrics.isLoading ? (
                    <div className="dark:bg-polar-700 flex h-full w-full items-center justify-center rounded-lg bg-gray-200">
                      <Spinner />
                    </div>
                  ) : (
                    <div
                      className={twMerge(
                        'absolute bottom-0 w-full rounded-lg',
                        index === array.length - 1
                          ? 'bg-indigo-400 dark:bg-indigo-700'
                          : 'dark:bg-polar-700 bg-gray-400',
                      )}
                      style={{
                        height: `${((period.revenue ?? 0) / maxRevenue) * 100}%`,
                      }}
                    />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <span>
                    {formatCurrency('compact')(period.revenue ?? 0, 'usd')} in{' '}
                    {format(period.timestamp, 'MMMM')}
                  </span>
                </TooltipContent>
              </Tooltip>
              <div className="flex flex-col text-left">
                <span className="text-sm lg:text-base">
                  {format(period.timestamp, 'MMMM')}
                </span>
                <div className="flex flex-row items-center justify-between gap-x-2">
                  <span className="dark:text-polar-600 text-sm text-gray-600">
                    {formatCurrency('statistics')(period.revenue ?? 0, 'usd')}
                  </span>
                  {!isTrendFlat ? (
                    <Tooltip>
                      <TooltipTrigger
                        className={twMerge(
                          'flex flex-row items-center gap-x-1 rounded-xs p-0.5 text-xs',
                          isTrendingUp
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60'
                            : 'bg-red-100 text-red-600 dark:bg-red-950/60',
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
    </WidgetContainer>
  )
}

export default RevenueWidget
