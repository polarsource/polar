import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { endOfMonth, isBefore, isSameDay, startOfMonth } from 'date-fns'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface MonthWidgetProps {
  className?: string
}

export const MonthWidget = ({ className }: MonthWidgetProps) => {
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth())

  const { organization } = useContext(OrganizationContext)

  const startDate = startOfMonth(new Date().setMonth(activeMonth))
  const endDate = endOfMonth(startDate)

  const orderMetrics = useMetrics({
    organization_id: organization.id,
    interval: 'day',
    startDate,
    endDate,
  })

  // Calculate weekday index for first day (Monday = 0, Sunday = 6)
  const firstDayWeekday = (startDate.getDay() + 6) % 7
  const days = orderMetrics.data?.periods ?? []
  const leadingEmptyCells = Array(firstDayWeekday).fill(null)
  const totalCells = leadingEmptyCells.length + days.length
  const trailingEmptyCells = Array((7 - (totalCells % 7)) % 7).fill(null)
  const calendarDays = [...leadingEmptyCells, ...days, ...trailingEmptyCells]

  const monthName = startDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })

  const isToday = useCallback((date: Date) => {
    return isSameDay(date, new Date())
  }, [])

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 rounded-4xl flex w-full flex-col bg-gray-100 p-2 text-black dark:text-white',
        className,
      )}
    >
      <div className="flex items-center justify-between p-4">
        <h2 className="text-xl">{monthName}</h2>
        <div className="flex items-center gap-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveMonth(activeMonth - 1)}
          >
            <ArrowLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={activeMonth === new Date().getMonth()}
            onClick={() => {
              const currentMonth = new Date().getMonth()
              const nextMonth = currentMonth + 1

              setActiveMonth(Math.min(nextMonth, currentMonth))
            }}
          >
            <ArrowRight />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-baseline gap-x-2">
          <h3 className="text-5xl font-light">
            {orderMetrics.data?.totals.orders.toLocaleString('en-US', {
              style: 'decimal',
              compactDisplay: 'short',
              notation: 'compact',
            })}
          </h3>
          <span className="text-lg">
            {orderMetrics.data?.totals.orders === 1 ? 'Order' : 'Orders'}
          </span>
        </div>
      </div>
      <div className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl bg-white px-2 py-4">
        <div className="grid grid-cols-7 justify-items-center">
          {weekDays.map((day, index) => (
            <div
              key={day + index}
              className="dark:text-polar-600 text-sm text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 justify-items-center gap-y-2">
          {calendarDays.map((day, index) => {
            if (!day) {
              // Render empty cell
              return (
                <div
                  key={index}
                  className="relative flex h-8 w-8 items-center justify-center"
                />
              )
            }
            const isPreviousDay =
              isBefore(day.timestamp, new Date()) && !isToday(day.timestamp)

            return (
              <div key={index}>
                <Tooltip>
                  <TooltipTrigger
                    className={twMerge(
                      'relative flex h-8 w-8 items-center justify-center rounded-full text-sm',
                      day.orders > 0 &&
                        'bg-black text-white dark:bg-white dark:text-black',
                      isToday(day.timestamp) && 'bg-blue-500 text-white',
                      isPreviousDay && '',
                    )}
                  >
                    {day.orders > 0 ? (
                      <span>
                        {day.orders.toLocaleString('en-US', {
                          style: 'decimal',
                          compactDisplay: 'short',
                          notation: 'compact',
                        })}
                      </span>
                    ) : (
                      <div
                        className={twMerge(
                          'dark:text-polar-700 relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 text-sm text-gray-200',
                          isToday(day.timestamp)
                            ? 'border-blue-500'
                            : 'dark:border-polar-700 border-gray-200',
                        )}
                      >
                        {day.orders === 0 && isPreviousDay ? (
                          <span className="dark:bg-polar-700 h-2 w-2 rounded-full bg-gray-200" />
                        ) : isToday(day.timestamp) ? (
                          <span className="text-white">
                            {day.orders.toLocaleString('en-US', {
                              style: 'decimal',
                              compactDisplay: 'short',
                              notation: 'compact',
                            })}
                          </span>
                        ) : undefined}
                      </div>
                    )}
                  </TooltipTrigger>
                  <TooltipContent className="flex flex-col gap-1">
                    <span className="dark:text-polar-500 text-sm text-gray-500">
                      {new Date(day.timestamp).toLocaleString('default', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span>
                      {day.orders.toLocaleString('en-US', {
                        style: 'decimal',
                      })}{' '}
                      {day.orders === 1 ? 'Order' : 'Orders'}
                    </span>
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
