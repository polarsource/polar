import { SubscriptionRecurringInterval } from '@polar-sh/sdk'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import React, { useCallback } from 'react'

interface SubscriptionTierRecurringIntervalSwitchProps {
  value: SubscriptionRecurringInterval
  onChange: (value: SubscriptionRecurringInterval) => void
  tabsListClassName?: string
  tabsTriggerClassName?: string
}

const SubscriptionTierRecurringIntervalSwitch: React.FC<
  SubscriptionTierRecurringIntervalSwitchProps
> = ({ value: value, onChange, tabsListClassName, tabsTriggerClassName }) => {
  const onValueChange = useCallback(
    (newValue: string) => {
      if (newValue === value) return
      onChange(newValue as SubscriptionRecurringInterval)
    },
    [onChange, value],
  )

  return (
    <Tabs onValueChange={onValueChange} value={value}>
      <TabsList className={tabsListClassName}>
        <TabsTrigger
          className={tabsTriggerClassName}
          value={SubscriptionRecurringInterval.MONTH}
          size="small"
        >
          Monthly Billing
        </TabsTrigger>
        <TabsTrigger
          className={tabsTriggerClassName}
          value={SubscriptionRecurringInterval.YEAR}
          size="small"
        >
          Yearly Billing
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export default SubscriptionTierRecurringIntervalSwitch
