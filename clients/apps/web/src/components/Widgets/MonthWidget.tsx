import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Check } from '@mui/icons-material'
import { endOfMonth, startOfMonth } from 'date-fns'
import { ArrowDown, Circle, CircleDashed } from 'lucide-react'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface Day {
  date: number
  tasks: number
  completedTasks: number
}

interface MonthWidgetProps {
  className?: string
}

export const MonthWidget = ({ className }: MonthWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const startDate = startOfMonth(new Date())
  const endDate = endOfMonth(new Date())

  const orderMetrics = useMetrics({
    organization_id: organization.id,
    interval: 'day',
    startDate,
    endDate,
  })

  const monthName = startDate.toLocaleString('default', { month: 'long' })

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex w-full flex-col gap-y-6 rounded-3xl bg-white p-6 text-white',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl">
          {monthName} <span className="font-light">totals</span>
        </h2>
        <ArrowDown />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-x-2">
          <h3 className="text-5xl font-light">
            {orderMetrics.data?.periods.filter((d) => d.orders > 0).length}
          </h3>
          <span className="text-lg">Days</span>
        </div>
        <div className="flex items-center gap-x-2">
          <div className="relative">
            <Check
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              fontSize="small"
            />
            <CircleDashed size={32} />
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs text-[#F5694A]">
              <span className="p-1">{orderMetrics.data?.totals.orders}</span>
            </div>
          </div>
          <span className="text-lg">Completed</span>
        </div>
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="grid grid-cols-7 justify-items-center">
          {weekDays.map((day) => (
            <div key={day} className="text-sm font-light">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 justify-items-center gap-y-2">
          {orderMetrics.data?.periods.map((day, index) => (
            <div
              key={index}
              className="relative flex h-8 w-8 items-center justify-center"
            >
              {day ? (
                <>
                  {day.orders > 0 ? (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm dark:text-black">
                      <div className="flex flex-col items-center">
                        <span>{day.orders}</span>
                      </div>
                    </div>
                  ) : (
                    <Circle
                      className="dark:text-polar-700 text-gray-400"
                      size={32}
                    />
                  )}
                </>
              ) : (
                <Circle
                  className="dark:text-polar-700 text-gray-400"
                  size={32}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Mock data for demonstration purposes
const mockDays: Day[] = [
  { date: 4, tasks: 1, completedTasks: 0 },
  { date: 8, tasks: 1, completedTasks: 0 },
  { date: 10, tasks: 2, completedTasks: 1 },
  { date: 13, tasks: 1, completedTasks: 0 },
  { date: 14, tasks: 3, completedTasks: 3 },
  { date: 15, tasks: 1, completedTasks: 0 },
  { date: 17, tasks: 1, completedTasks: 0 },
  { date: 18, tasks: 4, completedTasks: 4 },
  { date: 19, tasks: 1, completedTasks: 0 },
  { date: 20, tasks: 2, completedTasks: 1 },
  { date: 21, tasks: 3, completedTasks: 2 },
  { date: 22, tasks: 1, completedTasks: 0 },
]

export const MonthWidgetPreview = () => {
  return (
    <div className="w-96">
      <MonthWidget
        monthName="November"
        days={mockDays}
        completedThreshold={0.99}
      />
    </div>
  )
}
