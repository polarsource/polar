import { SubscriptionStatus } from '@polar-sh/api'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import React from 'react'
import { subscriptionStatusDisplayNames } from './utils'

interface SubscriptionStatusSelectProps {
  statuses: [
    typeof SubscriptionStatus.ACTIVE,
    typeof SubscriptionStatus.CANCELED,
  ]
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
              <SelectItem value={status} className="font-medium">
                <div className="flex items-center gap-2 whitespace-normal">
                  {subscriptionStatusDisplayNames[status]}
                </div>
              </SelectItem>
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SubscriptionStatusSelect
