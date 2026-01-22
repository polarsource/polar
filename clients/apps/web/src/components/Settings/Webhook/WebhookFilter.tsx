'use client'

import DateRangePicker, {
  DateRange,
} from '@/components/Metrics/DateRangePicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import React from 'react'
import { WebhookEventTypeSelect } from './WebhookEventTypeSelect'

interface WebhookFilterProps {
  onDateRangeChange: (dateRange?: DateRange) => void
  dateRange?: DateRange
  className?: string
  succeeded?: string
  onSucceededChange: (value: string | null) => void
  httpCodeClass?: string
  onHttpCodeClassChange: (value: string | null) => void
  eventTypes: string[]
  onEventTypesChange: (eventTypes: string[]) => void
  query?: string
  onQueryChange: (value: string) => void
}

export const WebhookFilter: React.FC<WebhookFilterProps> = ({
  onDateRangeChange,
  dateRange,
  className,
  succeeded,
  onSucceededChange,
  httpCodeClass,
  onHttpCodeClassChange,
  eventTypes,
  onEventTypesChange,
  query,
  onQueryChange,
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-4 ${className ?? ''}`}>
      <Select
        value={succeeded ?? 'all'}
        onValueChange={(value) => {
          onSucceededChange(value === 'all' ? null : value)
        }}
      >
        <SelectTrigger className="w-auto min-w-32">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="true">Succeeded</SelectItem>
          <SelectItem value="false">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={httpCodeClass ?? 'all'}
        onValueChange={(value) => {
          onHttpCodeClassChange(value === 'all' ? null : value)
        }}
      >
        <SelectTrigger className="w-auto min-w-32">
          <SelectValue placeholder="HTTP Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All HTTP Responses</SelectItem>
          <SelectItem value="2xx">2xx Success</SelectItem>
          <SelectItem value="3xx">3xx Redirect</SelectItem>
          <SelectItem value="4xx">4xx Client Error</SelectItem>
          <SelectItem value="5xx">5xx Server Error</SelectItem>
        </SelectContent>
      </Select>

      <WebhookEventTypeSelect
        selectedEventTypes={eventTypes}
        onSelectEventTypes={onEventTypesChange}
      />

      <Input
        placeholder="Search Deliveries"
        value={query ?? ''}
        onChange={(e) => onQueryChange(e.target.value)}
        className="w-auto min-w-48"
      />

      <DateRangePicker date={dateRange} onDateChange={onDateRangeChange} />
    </div>
  )
}

export default WebhookFilter
