'use client'

import DateRangePicker, {
  DateRange,
} from '@/components/Metrics/DateRangePicker'
import React from 'react'

interface WebhookFilterProps {
  onDateRangeChange: (dateRange?: DateRange) => void
  dateRange?: DateRange
  className?: string
}

export const WebhookFilter: React.FC<WebhookFilterProps> = ({
  onDateRangeChange,
  dateRange,
  className,
}) => {
  return (
    <div className={className}>
      <DateRangePicker date={dateRange} onDateChange={onDateRangeChange} />
    </div>
  )
}

export default WebhookFilter
