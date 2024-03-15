import {
  SubscriptionTier,
  SubscriptionTierPrice,
  TransactionSubscriptionTier,
} from '@polar-sh/sdk'
import SubscriptionTierPriceLabel from './SubscriptionTierPriceLabel'
import { getSubscriptionColorByType } from './utils'

interface SubscriptionTierPillProps {
  subscriptionTier: SubscriptionTier | TransactionSubscriptionTier
  price?: SubscriptionTierPrice
}

const SubscriptionTierPill: React.FC<SubscriptionTierPillProps> = ({
  subscriptionTier,
  price,
}) => {
  const color = getSubscriptionColorByType(subscriptionTier.type)
  return (
    <div className="flex  items-center justify-between gap-3">
      <div
        style={{ backgroundColor: color }}
        className="dark:text-polar-950 inline-flex gap-1 whitespace-nowrap rounded-xl px-3 py-1 text-xs text-white"
      >
        <div>{subscriptionTier.name}</div>
        {price && (
          <>
            <div>·</div>
            <SubscriptionTierPriceLabel price={price} />
          </>
        )}
      </div>
    </div>
  )
}

export default SubscriptionTierPill
