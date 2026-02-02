'use client'

import { schemas } from '@spaire/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@spaire/ui/components/atoms/Select'

const PRORATION_BEHAVIOR_LABELS: Record<
  schemas['SubscriptionProrationBehavior'],
  string
> = {
  invoice: 'Invoice Immediately',
  prorate: 'Next Invoice',
}

export interface ProrationBehaviorProps {
  value: schemas['SubscriptionProrationBehavior']
  onValueChange: (value: string) => void
}

export const ProrationBehavior: React.FC<ProrationBehaviorProps> = ({
  value,
  onValueChange,
  ...props
}) => {
  return (
    <Select {...props} value={value} onValueChange={onValueChange}>
      <SelectTrigger>{PRORATION_BEHAVIOR_LABELS[value]}</SelectTrigger>
      <SelectContent>
        {Object.entries(PRORATION_BEHAVIOR_LABELS).map(([key, label]) => (
          <SelectItem value={key} key={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
