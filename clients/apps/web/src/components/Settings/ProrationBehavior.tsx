'use client'

import { schemas } from '@polar-sh/client'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'

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
    <Tabs {...props} value={value} onValueChange={onValueChange}>
      <TabsList className="dark:bg-polar-800 w-full rounded-full bg-gray-100">
        {Object.entries(PRORATION_BEHAVIOR_LABELS).map(([key, label]) => (
          <TabsTrigger
            className="dark:data-[state=active]:bg-polar-900 w-full !rounded-full data-[state=active]:bg-white"
            value={key}
            key={key}
            size="small"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
