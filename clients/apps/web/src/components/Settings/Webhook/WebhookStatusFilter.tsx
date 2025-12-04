'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import React from 'react'

export type WebhookStatusFilterValue = 'all' | 'succeeded' | 'failed'

interface WebhookStatusFilterProps {
  value: WebhookStatusFilterValue
  onChange: (value: WebhookStatusFilterValue) => void
}

const WebhookStatusFilter: React.FC<WebhookStatusFilterProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectSeparator />
        <SelectItem value="succeeded">
          <span className="text-green-500">Succeeded</span>
        </SelectItem>
        <SelectItem value="failed">
          <span className="text-red-500">Failed</span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export default WebhookStatusFilter
