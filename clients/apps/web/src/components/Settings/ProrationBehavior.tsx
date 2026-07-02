'use client'

import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@polar-sh/orbit'

const PRORATION_BEHAVIOR_LABELS: Record<
  schemas['SubscriptionProrationBehavior'],
  string
> = {
  invoice: 'Prorate & charge now',
  prorate: 'Prorate on next invoice',
  next_period: 'Schedule for next cycle',
  reset: 'Charge full amount & reset cycle',
  auto: 'Prorate upgrades, schedule downgrades'
}

export interface ProrationBehaviorProps {
  organization: schemas['Organization']
  value: schemas['SubscriptionProrationBehavior']
  onValueChange: (value: string) => void
  disabled?: boolean
}

export const ProrationBehavior: React.FC<ProrationBehaviorProps> = ({
  organization,
  value,
  onValueChange,
  ...props
}) => {
  return (
    <Select {...props} value={value} onValueChange={onValueChange}>
      <SelectTrigger>{PRORATION_BEHAVIOR_LABELS[value]}</SelectTrigger>
      <SelectContent>
        {Object.entries(PRORATION_BEHAVIOR_LABELS)
          .filter(
            ([key]) =>
              key !== 'reset' ||
              organization.feature_settings?.reset_proration_behavior_enabled,
          )
          .map(([key, label]) => (
            <SelectItem value={key} key={key}>
              {label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
