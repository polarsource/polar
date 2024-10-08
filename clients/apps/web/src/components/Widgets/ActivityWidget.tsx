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

export interface ActivityWidgetProps {
  className?: string
}

export const ActivityWidget = ({ className }: ActivityWidgetProps) => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - 1)

  const orderMetrics = useMetrics({
    organizationId: org.id,
    interval: 'day',
    startDate: getNearestMonday(startDate),
    endDate: new Date(),
  })

  return (
    <Card
      className={twMerge(
        'hidden h-80 flex-col justify-between md:flex',
        className,
      )}
    >
      <CardHeader>
        <h2 className="dark:text-polar-500 text-gray-400">
          {new Date().toLocaleDateString('en-US', {
            year: 'numeric',
          })}
        </h2>
        <h2 className="text-xl">Orders</h2>
      </CardHeader>
      <TooltipProvider>
        <CardFooter className="flex flex-row gap-x-4">
          <div className="hidden flex-col items-center font-mono xl:flex">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <span
                key={i}
                className="dark:text-polar-500 text-xs text-gray-200"
              >
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-cols-[repeat(52,minmax(0,1fr))] grid-rows-[repeat(7,minmax(0,1fr))] gap-1 xl:gap-2">
            {orderMetrics.data?.periods.map((period, i) => {
              const activeClass =
                period.orders > 0
                  ? 'bg-blue-500 dark:bg-blue-500'
                  : 'hover:bg-blue-100 dark:hover:bg-blue-900'

              const tooltipContent = `${period.orders} ${period.orders === 1 ? 'order' : 'orders'} ${period.timestamp.toLocaleDateString(
                'en-US',
                {
                  month: 'long',
                  day: 'numeric',
                },
              )}`

              return (
                <Tooltip key={i} delayDuration={0}>
                  <TooltipTrigger
                    className={twMerge(
                      'dark:bg-polar-600 h-1 w-1 rounded-full bg-gray-100 xl:h-2 xl:w-2',
                      activeClass,
                    )}
                  />
                  <TooltipContent className="text-sm">
                    {tooltipContent}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </CardFooter>
      </TooltipProvider>
    </Card>
  )
}

function getNearestMonday(date: Date) {
  const dayOfWeek = date.getDay() // Sunday - 0, Monday - 1, ..., Saturday - 6
  const distanceToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nearestMonday = new Date(date)
  nearestMonday.setDate(date.getDate() + distanceToMonday)
  return nearestMonday
}
