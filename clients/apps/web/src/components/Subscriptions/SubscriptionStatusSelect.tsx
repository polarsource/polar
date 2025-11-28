import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import React from 'react'
import { subscriptionStatusDisplayNames } from './utils'

interface SubscriptionStatusSelectProps {
  statuses: ('active' | 'canceled')[]
  value: string
  onChange: (value: string) => void
}

const SubscriptionStatusSelect: React.FC<SubscriptionStatusSelectProps> = ({
  statuses,
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">
          <span className="whitespace-nowrap">Any status</span>
        </SelectItem>
        <SelectSeparator />
        {statuses.map((status) => (
          <React.Fragment key={status}>
            <SelectGroup>
              <SelectItem value={status}>
                {subscriptionStatusDisplayNames[status]}
              </SelectItem>
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SubscriptionStatusSelect
