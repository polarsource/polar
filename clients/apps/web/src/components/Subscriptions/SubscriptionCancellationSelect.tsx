import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import React from 'react'

interface SubscriptionCancellationSelectProps {
  value: string
  onChange: (value: string) => void
}

const SubscriptionCancellationSelect: React.FC<
  SubscriptionCancellationSelectProps
> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
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
