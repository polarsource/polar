import { SubscriptionRecurringInterval } from '@polar-sh/sdk'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import React from 'react'

interface SubscriptionTierRecurringIntervalSwitchProps {
  recurringInterval: SubscriptionRecurringInterval
  onChange: (recurringInterval: SubscriptionRecurringInterval) => void
}

const SubscriptionTierRecurringIntervalSwitch: React.FC<
  SubscriptionTierRecurringIntervalSwitchProps
> = ({ recurringInterval, onChange }) => {
  const onCheckedChange = (checked: string) => {
    onChange(checked as SubscriptionRecurringInterval)
  }

  return (
    <Tabs onValueChange={onCheckedChange} value={recurringInterval}>
      <TabsList>
        <TabsTrigger value={SubscriptionRecurringInterval.MONTH} size="small">
          Monthly Billing
        </TabsTrigger>
        <TabsTrigger value={SubscriptionRecurringInterval.YEAR} size="small">
          Yearly Billing
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export default SubscriptionTierRecurringIntervalSwitch
