import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { DEFAULT_LOCALE, type AcceptedLocale } from '@polar-sh/i18n'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'
import { cn } from '@polar-sh/ui/lib/utils'

interface MeteredPriceLabelProps {
  price: schemas['ProductPriceMeteredUnit']
  locale?: AcceptedLocale
  discount?: schemas['CheckoutPublic']['discount']
}

const MeteredPriceLabel: React.FC<MeteredPriceLabelProps> = ({
  price,
  locale = DEFAULT_LOCALE,
  discount,
}) => {
  const { scale, label } = getMeterUnitFormat(price.meter.unit ?? 'scalar', {
    customLabel: price.meter.custom_label,
    customMultiplier: price.meter.custom_multiplier,
  })

  const format = formatCurrency('subcent', locale)
  const baseAmount = Number.parseFloat(price.unit_amount) * scale
  const discountedAmount =
    discount && 'basis_points' in discount
      ? baseAmount * (1 - discount.basis_points / 10000)
      : null

  return (
    <div className="flex flex-row items-baseline gap-x-1">
      {discountedAmount !== null ? (
        <>
          <span className="dark:text-polar-500 text-gray-400 line-through">
            {format(baseAmount, price.price_currency)}
          </span>
          <span>{format(discountedAmount, price.price_currency)}</span>
        </>
      ) : (
        format(baseAmount, price.price_currency)
      )}
      <span
        className={cn(
          'dark:text-polar-400 text-[max(12px,0.5em)] text-gray-500',
          price.meter.unit === 'custom' ? 'lowercase' : '',
        )}
      >
        / {label}
      </span>
    </div>
  )
}

export default MeteredPriceLabel
