'use client'

import {
  endOfDay,
  endOfMonth,
  endOfToday,
  endOfWeek,
  endOfYear,
  endOfYesterday,
  format,
  startOfDay,
  startOfMonth,
  startOfToday,
  startOfWeek,
  startOfYear,
  startOfYesterday,
  subMonths,
  subYears,
} from 'date-fns'
import * as React from 'react'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import { schemas } from '@polar-sh/client'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import { Calendar } from '@polar-sh/ui/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

const intervals = (
  organization: schemas['Organization'],
): DateRangeInterval[] => [
  {
    slug: 'today',
    label: 'Today',
    value: [startOfToday(), endOfToday()],
  },
  {
    slug: 'yesterday',
    label: 'Yesterday',
    value: [startOfYesterday(), endOfYesterday()],
  },
  {
    slug: 'thisWeek',
    label: 'This Week',
    value: [startOfWeek(new Date()), endOfWeek(new Date())],
  },
  {
    slug: 'thisMonth',
    label: 'This Month',
    value: [startOfMonth(new Date()), endOfMonth(new Date())],
  },
  {
    slug: 'lastMonth',
    label: 'Last Month',
    value: [
      startOfMonth(subMonths(new Date(), 1)),
      endOfMonth(subMonths(new Date(), 1)),
    ],
  },
  {
    slug: 'last3Months',
    label: 'Last 3 Months',
    value: [subMonths(startOfToday(), 3), endOfToday()],
  },
  {
    slug: 'thisYear',
    label: 'This Year',
    value: [startOfYear(new Date()), endOfYear(new Date())],
  },
  {
    slug: 'lastYear',
    label: 'Last Year',
    value: [
      startOfYear(subYears(new Date(), 1)),
      endOfYear(subYears(new Date(), 1)),
    ],
  },
  {
    slug: 'allTime',
    label: 'All Time',
    value: [startOfDay(new Date(organization.created_at)), endOfToday()],
  },
]

const dateToInterval = (
  date: DateRange,
  organization: schemas['Organization'],
) => {
  // Compare dates by their date-only representation (ignoring time)
  // to handle cases where times differ after roundtripping through query params
  const fromDate = format(date.from, 'yyyy-MM-dd')
  const toDate = format(date.to, 'yyyy-MM-dd')

  return intervals(organization).find((interval) => {
    const intervalFromDate = format(interval.value[0], 'yyyy-MM-dd')
    const intervalToDate = format(interval.value[1], 'yyyy-MM-dd')
    return fromDate === intervalFromDate && toDate === intervalToDate
  })
}

export type DateRange = {
  from: Date
  to: Date
}

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined
  onDateChange: (v: DateRange) => void
  minDate?: Date
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  className,
  date,
  onDateChange,
  minDate,
}) => {
  const { organization } = useContext(OrganizationContext)
  const interval = date ? dateToInterval(date, organization) : undefined

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 dark:bg-polar-800 dark:divide-polar-700 flex h-10 w-52 flex-row divide-x divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs',
        className,
      )}
    >
      <Popover>
        <PopoverTrigger className="dark:hover:bg-polar-700 flex cursor-pointer items-center justify-center px-4 py-3 duration-150 hover:bg-gray-100">
          <CalendarMonthOutlined fontSize="inherit" />
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={date?.to}
            selected={date}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(v) => {
              onDateChange({
                from: startOfDay(v?.from ?? new Date()),
                to: endOfDay(v?.to ?? new Date()),
              })
            }}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger className="dark:hover:bg-polar-700 flex-1 cursor-pointer truncate px-4 text-sm duration-150 hover:bg-gray-100">
          {interval ? (
            interval.label
          ) : date?.from ? (
            date.to ? (
              <FormattedInterval
                startDatetime={date.from}
                endDatetime={date.to}
              />
            ) : (
              format(date.from, 'LLL dd, yy')
            )
          ) : (
            <span>Pick a date</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-2">
          <DateRangeIntervals
            interval={interval}
            onIntervalChange={(int) => {
              onDateChange({
                from: int.value[0],
                to: int.value[1],
              })
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface DateRangeInterval {
  slug:
    | 'today'
    | 'yesterday'
    | 'thisWeek'
    | 'lastWeek'
    | 'thisMonth'
    | 'lastMonth'
    | 'last3Months'
    | 'thisYear'
    | 'lastYear'
    | 'allTime'
  label: string
  value: [Date, Date]
}

interface DateRangeIntervalProps {
  interval: DateRangeInterval | undefined
  onIntervalChange: (interval: DateRangeInterval) => void
}

const DateRangeIntervals = ({
  interval,
  onIntervalChange,
}: DateRangeIntervalProps) => {
  const { organization } = useContext(OrganizationContext)

  return (
    <div className="flex w-full flex-col gap-1">
      {intervals(organization).map((int) => (
        <div
          key={int.slug}
          onClick={() => onIntervalChange(int)}
          role="button"
          className={twMerge(
            'dark:hover:bg-polar-800 dark:text-polar-500 flex w-full items-center justify-between rounded-sm border border-transparent px-3 py-2 text-sm text-gray-500 select-none hover:bg-gray-100',
            interval?.slug === int.slug &&
              'dark:bg-polar-800 dark:border-polar-700 bg-gray-100 text-black dark:text-white',
          )}
        >
          {int.label}
        </div>
      ))}
    </div>
  )
}

export default DateRangePicker
