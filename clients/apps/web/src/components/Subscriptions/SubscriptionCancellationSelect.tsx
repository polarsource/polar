import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import React from 'react'

interface SubscriptionCancellationSelectProps {
  value: boolean | null
  onChange: (value: boolean | null) => void
}

const SubscriptionCancellationSelect: React.FC<
  SubscriptionCancellationSelectProps
> = ({ value, onChange }) => {
  return (
    <Select
      value={value === null ? 'all' : String(value)}
      onValueChange={(value) =>
        onChange(value === 'all' ? null : value === 'true')
      }
    >
      <SelectTrigger>
        <SelectValue placeholder="Select cancellation status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="whitespace-nowrap">All active subscriptions</span>
        </SelectItem>
        <SelectItem value="false">
          <span className="whitespace-nowrap">Renewing subscriptions</span>
        </SelectItem>
        <SelectItem value="true">
          <span className="whitespace-nowrap">Ending at period end</span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

export default SubscriptionCancellationSelect
