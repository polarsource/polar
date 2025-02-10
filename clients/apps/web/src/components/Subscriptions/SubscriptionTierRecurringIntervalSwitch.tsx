import { components } from '@polar-sh/client'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import React, { useCallback } from 'react'

interface SubscriptionTierRecurringIntervalSwitchProps {
  value: components['schemas']['SubscriptionRecurringInterval']
  onChange: (
    value: components['schemas']['SubscriptionRecurringInterval'],
  ) => void
  tabsListClassName?: string
  tabsTriggerClassName?: string
}

const SubscriptionTierRecurringIntervalSwitch: React.FC<
  SubscriptionTierRecurringIntervalSwitchProps
> = ({ value: value, onChange, tabsListClassName, tabsTriggerClassName }) => {
  const onValueChange = useCallback(
    (newValue: string) => {
      if (newValue === value) return
      onChange(
        newValue as components['schemas']['SubscriptionRecurringInterval'],
      )
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
