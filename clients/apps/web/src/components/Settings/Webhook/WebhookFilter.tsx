"use client"

import { CalendarIcon } from '@heroicons/react/24/outline'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Calendar, DateRange } from '@polar-sh/ui/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import React from 'react'

export interface WebhookFilterState {
  dateRange?: DateRange
}

interface WebhookFilterProps {
  onFilterChange: (filters: WebhookFilterState) => void
  initialFilters?: WebhookFilterState
  className?: string
}

export const WebhookFilter: React.FC<WebhookFilterProps> = ({
  onFilterChange,
  initialFilters = {},
  className,
}) => {
  const [range, setRange] = React.useState<DateRange | undefined>(
    initialFilters.dateRange
  )

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setRange(dateRange)
    onFilterChange({ dateRange })
  }

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <CalendarIcon className="h-4 w-4" />
            {range?.from && range?.to
              ? `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`
              : range?.from
              ? range.from.toLocaleDateString()
              : "Filter by date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="end">
          <Calendar
            className="w-full"
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={handleDateRangeChange}
            fixedWeeks
            showOutsideDays
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default WebhookFilter
