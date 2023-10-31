import { SubscriptionTier } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'

interface SubscriptionTierPillProps {
  subscriptionTier: SubscriptionTier
  amount: number
}

const SubscriptionTierPill: React.FC<SubscriptionTierPillProps> = ({
  subscriptionTier,
  amount,
}) => {
  return (
    <div className="dark:text-polar-50 flex items-center justify-between gap-2 whitespace-nowrap rounded-xl border border-blue-200 py-0.5 pl-2 pr-0.5 text-xs text-gray-900 dark:border-blue-800">
      <div>{subscriptionTier.name}</div>
      <div
        className="rounded-xl bg-blue-100 px-1 dark:bg-blue-700"
        style={{ fontSize: 10 }}
      >
        ${getCentsInDollarString(amount, undefined, true)}
      </div>
    </div>
  )
}

export default SubscriptionTierPill
