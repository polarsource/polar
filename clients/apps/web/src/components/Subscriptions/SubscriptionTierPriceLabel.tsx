import { formatCurrencyAndAmount } from '@/utils/money'
import {
  SubscriptionTierPrice,
  SubscriptionTierPriceRecurringInterval,
} from '@polar-sh/sdk'
import { useMemo } from 'react'

interface SubscriptionTierPriceLabelProps {
  price: SubscriptionTierPrice
}

const SubscriptionTierPriceLabel: React.FC<SubscriptionTierPriceLabelProps> = ({
  price,
}) => {
  const { recurring_interval, price_amount, price_currency } = price
  const intervalDisplay = useMemo(() => {
    switch (recurring_interval) {
      case SubscriptionTierPriceRecurringInterval.MONTH:
        return '/ mo'
      case SubscriptionTierPriceRecurringInterval.YEAR:
        return '/ yr'
    }
  }, [recurring_interval])

  return (
    <div>
      {formatCurrencyAndAmount(price_amount, price_currency, 0)}{' '}
      {intervalDisplay}
    </div>
  )
}

export default SubscriptionTierPriceLabel
