import { SubscriptionTier, SubscriptionTierType } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { getSubscriptionColorByType } from './utils'

interface SubscriptionTierPillProps {
  subscriptionTier: SubscriptionTier
  amount: number
}

const SubscriptionTierPill: React.FC<SubscriptionTierPillProps> = ({
  subscriptionTier,
  amount,
}) => {
  const color = getSubscriptionColorByType(subscriptionTier.type)
  return (
    <div className="flex items-center justify-between gap-3">
      <div
        style={{ backgroundColor: color }}
        className="dark:text-polar-950 whitespace-nowrap rounded-xl px-3 py-1 text-xs text-white"
      >
        {subscriptionTier.name}
      </div>
      {subscriptionTier.type !== SubscriptionTierType.FREE && (
        <div className="text-sm">
          ${getCentsInDollarString(amount, undefined, true)}
        </div>
      )}
    </div>
  )
}

export default SubscriptionTierPill
