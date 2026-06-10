'use client'

import DateRangePicker, {
  DateRange,
} from '@/components/Metrics/DateRangePicker'
import { Input } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
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
          <SelectValue placeholder="Status" translate="no" />
        </SelectTrigger>
        <SelectContent translate="no">
          <SelectItem value="all">
            <div>All Statuses</div>
          </SelectItem>
          <SelectItem value="true">
            <div>Succeeded</div>
          </SelectItem>
          <SelectItem value="false">
            <div>Failed</div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={httpCodeClass ?? 'all'}
        onValueChange={(value) => {
          onHttpCodeClassChange(value === 'all' ? null : value)
        }}
      >
        <SelectTrigger className="w-auto min-w-32">
          <SelectValue placeholder="HTTP Status" translate="no" />
        </SelectTrigger>
        <SelectContent translate="no">
          <SelectItem value="all">
            <div>All HTTP Responses</div>
          </SelectItem>
          <SelectItem value="2xx">
            <div>2xx Success</div>
          </SelectItem>
          <SelectItem value="3xx">
            <div>3xx Redirect</div>
          </SelectItem>
          <SelectItem value="4xx">
            <div>4xx Client Error</div>
          </SelectItem>
          <SelectItem value="5xx">
            <div>5xx Server Error</div>
          </SelectItem>
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
