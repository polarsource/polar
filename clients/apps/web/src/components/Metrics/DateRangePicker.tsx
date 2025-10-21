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
  startOfYesterday,
  subMonths,
  subYears,
} from 'date-fns'
import * as React from 'react'
import { useContext, useEffect } from 'react'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import {
  Calendar,
  DateRange as InternalDateRange,
} from '@polar-sh/ui/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { twMerge } from 'tailwind-merge'

export type DateRange = {
  from: Date
  to: Date
}

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined
  onDateChange: (v: DateRange) => void
  maxDaysRange?: number
  minDate?: Date
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  className,
  date,
  onDateChange,
  maxDaysRange,
  minDate,
}) => {
  const [internalDate, setInternalDate] = React.useState<
    InternalDateRange | undefined
  >(date)
  const [interval, setInterval] = React.useState<DateRangeInterval | undefined>(
    undefined,
  )

  useEffect(() => {
    if (internalDate && internalDate.from && internalDate.to) {
      onDateChange({
        from: startOfDay(internalDate.from),
        to: endOfDay(internalDate.to),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalDate])

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 dark:bg-polar-800 shadow-xs dark:divide-polar-700 flex flex-row divide-x divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white',
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
            defaultMonth={internalDate?.to}
            selected={internalDate}
            max={maxDaysRange}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(v) => {
              setInternalDate(v)
              setInterval(undefined)
            }}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger className="dark:hover:bg-polar-700 flex-1 cursor-pointer text-sm duration-150 hover:bg-gray-100">
          {interval ? (
            interval.label
          ) : date?.from ? (
            date.to ? (
              <>
                {format(date.from, 'LLL dd, y')} -{' '}
                {format(date.to, 'LLL dd, y')}
              </>
            ) : (
              format(date.from, 'LLL dd, y')
            )
          ) : (
            <span>Pick a date</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-2">
          <DateRangeIntervals
            interval={interval}
            onIntervalChange={(int) => {
              setInterval(int)
              setInternalDate({
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

  const intervals: DateRangeInterval[] = [
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
      value: [subMonths(new Date(), 3), new Date()],
    },
    {
      slug: 'thisYear',
      label: 'This Year',
      value: [endOfYear(subYears(new Date(), 1)), endOfYear(new Date())],
    },
    {
      slug: 'lastYear',
      label: 'Last Year',
      value: [
        endOfYear(subYears(new Date(), 2)),
        endOfYear(subYears(new Date(), 1)),
      ],
    },
    {
      slug: 'allTime',
      label: 'All Time',
      value: [new Date(organization.created_at), new Date()],
    },
  ]

  return (
    <div className="flex w-full flex-col gap-1">
      {intervals.map((int) => (
        <div
          key={int.slug}
          onClick={() => onIntervalChange(int)}
          role="button"
          className={twMerge(
            'dark:hover:bg-polar-800 dark:text-polar-500 flex w-full items-center justify-between rounded-sm border border-transparent px-3 py-2 text-sm text-gray-500 hover:bg-gray-100',
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
