'use client'

import { CalendarIcon } from '@heroicons/react/24/outline'
import {
  endOfMonth,
  endOfToday,
  endOfWeek,
  endOfYear,
  endOfYesterday,
  format,
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
import Button from '@polar-sh/ui/components/atoms/Button'
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
  date: DateRange
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
        from: internalDate.from,
        to: internalDate.to,
      })
    }
  }, [internalDate, onDateChange])

  return (
    <div className={twMerge('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger
          asChild
          className="dark:bg-polar-800 !rounded-xl border-gray-200 bg-white shadow-sm"
        >
          <Button
            id="date"
            variant={'outline'}
            className={twMerge(
              'h-10 justify-start rounded-md text-left font-normal',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
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
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="flex w-auto flex-col p-0 md:flex-row"
          align="start"
        >
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
          <Calendar
            initialFocus
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
    <div className="flex w-48 flex-col gap-1 p-4">
      {intervals.map((int) => (
        <div
          key={int.slug}
          onClick={() => onIntervalChange(int)}
          role="button"
          className={twMerge(
            'dark:hover:bg-polar-800 dark:text-polar-500 flex w-full items-center justify-between rounded-sm border border-transparent px-2 py-1 text-sm text-gray-500 hover:bg-gray-100',
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
