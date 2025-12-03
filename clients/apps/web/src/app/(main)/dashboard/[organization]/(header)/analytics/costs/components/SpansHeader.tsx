'use client'

import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import { schemas } from '@polar-sh/client'

interface SpansHeaderProps {
  dateRange: { from: Date; to: Date }
  interval: schemas['TimeInterval']
  startDate: Date
  endDate: Date
  onDateRangeChange: (dateRange: { from: Date; to: Date }) => void
  onIntervalChange: (interval: schemas['TimeInterval']) => void
}

export function SpansHeader({
  dateRange,
  interval,
  startDate,
  endDate,
  onDateRangeChange,
  onIntervalChange,
}: SpansHeaderProps) {
  return (
    <div className="flex flex-row items-center justify-between gap-2">
      <div>
        <IntervalPicker
          interval={interval}
          onChange={onIntervalChange}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
      <div>
        <DateRangePicker date={dateRange} onDateChange={onDateRangeChange} />
      </div>
    </div>
  )
}
