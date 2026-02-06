import { type SupportedLocale, useTranslations } from '@polar-sh/i18n'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct'
import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice'
import { isLegacyRecurringPrice } from '../utils/product'
import AmountLabel from './AmountLabel'
import MeteredPriceLabel from './MeteredPriceLabel'

interface ProductPriceLabelProps {
  product: CheckoutProduct
  price: ProductPrice | LegacyRecurringProductPrice
  locale?: SupportedLocale
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
  price,
  locale,
}) => {
  const t = useTranslations(locale ?? 'en')

  if (price.amountType === 'fixed') {
    return (
      <AmountLabel
        amount={price.priceAmount}
        currency={price.priceCurrency}
        interval={
          isLegacyRecurringPrice(price)
            ? price.recurringInterval
            : product.recurringInterval
        }
        intervalCount={product.recurringIntervalCount}
        mode="compact"
        locale={locale}
      />
    )
  } else if (price.amountType === 'custom') {
    return <div className="text-[min(1em,24px)]">{t('checkout.pricing.payWhatYouWant')}</div>
  } else if (price.amountType === 'free') {
    return <div className="text-[min(1em,24px)]">{t('checkout.pricing.free')}</div>
  } else if (price.amountType === 'metered_unit') {
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
