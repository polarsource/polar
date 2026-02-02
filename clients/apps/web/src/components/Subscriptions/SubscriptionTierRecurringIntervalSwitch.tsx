import { schemas } from '@spaire/client'
import { Tabs, TabsList, TabsTrigger } from '@spaire/ui/components/atoms/Tabs'
import React, { useCallback } from 'react'

interface SubscriptionTierRecurringIntervalSwitchProps {
  value: schemas['SubscriptionRecurringInterval']
  onChange: (value: schemas['SubscriptionRecurringInterval']) => void
  tabsListClassName?: string
  tabsTriggerClassName?: string
}

const SubscriptionTierRecurringIntervalSwitch: React.FC<
  SubscriptionTierRecurringIntervalSwitchProps
> = ({ value: value, onChange, tabsListClassName, tabsTriggerClassName }) => {
  const onValueChange = useCallback(
    (newValue: string) => {
      if (newValue === value) return
      onChange(newValue as schemas['SubscriptionRecurringInterval'])
    },
    [onChange, value],
  )

  return (
    <Tabs onValueChange={onValueChange} value={value}>
      <TabsList className={tabsListClassName}>
        <TabsTrigger
          className={tabsTriggerClassName}
          value="month"
          size="small"
        >
          Monthly Billing
        </TabsTrigger>
        <TabsTrigger className={tabsTriggerClassName} value="year" size="small">
          Yearly Billing
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export default SubscriptionTierRecurringIntervalSwitch
