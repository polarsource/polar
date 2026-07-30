import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import React from 'react'
import { subscriptionStatusDisplayNames } from './utils'

const SELECTABLE_STATUSES = [
  'active',
  'trialing',
  'paused',
  'past_due',
  'canceled',
  'unpaid',
] as const satisfies readonly schemas['SubscriptionStatus'][]

export const subscriptionStatusFilterValues = [
  'any',
  ...SELECTABLE_STATUSES,
] as const

export type SubscriptionStatusFilter =
  (typeof subscriptionStatusFilterValues)[number]

interface SubscriptionStatusSelectProps {
  value: SubscriptionStatusFilter
  onChange: (value: SubscriptionStatusFilter) => void
}

const SubscriptionStatusSelect: React.FC<SubscriptionStatusSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select
      value={value}
      onValueChange={(value) => onChange(value as SubscriptionStatusFilter)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">
          <span className="whitespace-nowrap">Any status</span>
        </SelectItem>
        <SelectSeparator />
        {SELECTABLE_STATUSES.map((status) => (
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
