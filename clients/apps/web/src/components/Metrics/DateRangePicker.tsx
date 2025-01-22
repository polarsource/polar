'use client'

import { CalendarIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import * as React from 'react'
import { useEffect } from 'react'

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
          className="dark:bg-polar-800 !rounded-full border-gray-200 bg-white shadow-sm"
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
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={internalDate?.to}
            selected={internalDate}
            max={maxDaysRange}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={setInternalDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default DateRangePicker
