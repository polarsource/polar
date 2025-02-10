'use client'

import { schemas } from '@polar-sh/client'
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'

const PRORATION_BEHAVIOR_LABELS: Record<
  schemas['SubscriptionProrationBehavior'],
  string
> = {
  invoice: 'Invoice immediately',
  prorate: 'Prorate on the next invoice',
}

const ProrationBehaviorRadioGroup: React.FC<
  React.ComponentPropsWithoutRef<typeof RadioGroup>
> = (props) => {
  return (
    <RadioGroup {...props}>
      {Object.entries(PRORATION_BEHAVIOR_LABELS).map(([key, label]) => (
        <div key={key} className="flex flex-row">
          <RadioGroupItem value={key} id={`reason-${key}`} />
          <Label className="ml-4 grow" htmlFor={`reason-${key}`}>
            {label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}

export default ProrationBehaviorRadioGroup
