'use client'

import DateRangePicker, {
  DateRange,
} from '@/components/Metrics/DateRangePicker'
import { cn } from '@polar-sh/ui/lib/utils'
import React from 'react'
import WebhookStatusFilter, {
  WebhookStatusFilterValue,
} from './WebhookStatusFilter'

interface WebhookFilterProps {
  statusFilter: WebhookStatusFilterValue
  onStatusFilterChange: (value: WebhookStatusFilterValue) => void
  onDateRangeChange: (dateRange?: DateRange) => void
  dateRange?: DateRange
  className?: string
}

export const WebhookFilter: React.FC<WebhookFilterProps> = ({
  onDateRangeChange,
  dateRange,
  statusFilter,
  onStatusFilterChange,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <WebhookStatusFilter
        value={statusFilter}
        onChange={onStatusFilterChange}
      />
      <DateRangePicker date={dateRange} onDateChange={onDateRangeChange} />
    </div>
  )
}

export default WebhookFilter
