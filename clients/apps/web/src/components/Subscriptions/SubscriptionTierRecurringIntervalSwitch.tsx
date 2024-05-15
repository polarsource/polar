import { ProductPriceRecurringInterval } from '@polar-sh/sdk'
import Switch from 'polarkit/components/ui/atoms/switch'
import React from 'react'

interface SubscriptionTierRecurringIntervalSwitchProps {
  recurringInterval: ProductPriceRecurringInterval
  onChange: (recurringInterval: ProductPriceRecurringInterval) => void
}

const SubscriptionTierRecurringIntervalSwitch: React.FC<
  SubscriptionTierRecurringIntervalSwitchProps
> = ({ recurringInterval, onChange }) => {
  const checked = recurringInterval === ProductPriceRecurringInterval.YEAR
  const onCheckedChange = (checked: boolean) => {
    onChange(
      checked
        ? ProductPriceRecurringInterval.YEAR
        : ProductPriceRecurringInterval.MONTH,
    )
  }

  return (
    <div className="flex flex-row gap-2">
      <label
        htmlFor="recurring-interval-switch"
        className="text-muted-foreground select-none text-sm"
      >
        Monthly
      </label>
      <Switch
        id="recurring-interval-switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <label
        htmlFor="recurring-interval-switch"
        className="text-muted-foreground select-none text-sm"
      >
        Yearly
      </label>
    </div>
  )
}

export default SubscriptionTierRecurringIntervalSwitch
