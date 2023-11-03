import { SubscriptionTierType } from '@polar-sh/sdk'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms'
import { getCentsInDollarString } from 'polarkit/money'
import React from 'react'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'
import { SubscriptionTiersByType, tiersTypeDisplayNames } from './utils'

interface SubscriptionTiersSelectProps {
  tiersByType: SubscriptionTiersByType
  value: string
  onChange: (value: string) => void
}

const SubscriptionTiersSelect: React.FC<SubscriptionTiersSelectProps> = ({
  tiersByType,
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a tier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All tiers</SelectItem>
        <SelectSeparator />
        {Object.entries(tiersByType).map(([type, tiers], index) => (
          <React.Fragment key={type}>
            <SelectGroup>
              <SelectItem value={type} className="font-medium">
                <div className="flex items-center gap-2">
                  <SubscriptionGroupIcon type={type as SubscriptionTierType} />
                  {tiersTypeDisplayNames[type as SubscriptionTierType]}
                </div>
              </SelectItem>
              {tiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tier.name} ($
                  {getCentsInDollarString(tier.price_amount, undefined, true)})
                </SelectItem>
              ))}
            </SelectGroup>
            {index < Object.entries(tiersByType).length - 1 && (
              <SelectSeparator />
            )}
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SubscriptionTiersSelect
