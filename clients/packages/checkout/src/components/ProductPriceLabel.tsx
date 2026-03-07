import type { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'
import MeteredPriceLabel from './MeteredPriceLabel'

interface ProductPriceLabelProps {
  product: schemas['CheckoutProduct']
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice']
  locale?: AcceptedLocale
  mode?: 'compact' | 'standard'
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
  price,
  locale = DEFAULT_LOCALE,
  mode = 'compact',
}) => {
  const t = useTranslations(locale)

  if (price.amount_type === 'fixed') {
    return (
      <AmountLabel
        amount={price.price_amount}
        currency={price.price_currency}
        interval={
          isLegacyRecurringPrice(price)
            ? price.recurring_interval
            : product.recurring_interval
        }
        intervalCount={product.recurring_interval_count}
        mode={mode}
        locale={locale}
      />
    )
  } else if (price.amount_type === 'custom') {
    return (
      <div className="text-[min(1em,24px)]">
        {t('checkout.pricing.payWhatYouWant')}
      </div>
    )
  } else if (price.amount_type === 'free') {
    return (
      <div className="text-[min(1em,24px)]">{t('checkout.pricing.free')}</div>
    )
  } else if (price.amount_type === 'seat_based') {
    const tiers = price.seat_tiers?.tiers ?? []
    const sortedTiers = [...tiers].sort((a, b) => a.min_seats - b.min_seats)
    const basePricePerSeat = sortedTiers[0]?.price_per_seat ?? 0
    return (
      <AmountLabel
        amount={basePricePerSeat}
        currency={price.price_currency}
        interval={product.recurring_interval}
        intervalCount={product.recurring_interval_count}
        mode={mode}
        locale={locale}
      />
    )
  } else if (price.amount_type === 'metered_unit') {
    return (
      <div className="flex flex-row gap-1 text-[min(1em,24px)]">
        {price.meter.name}
        {' — '}
        <MeteredPriceLabel price={price} locale={locale} />
      </div>
    )
  }
}

export default ProductPriceLabel
