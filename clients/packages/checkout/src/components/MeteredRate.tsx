import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { DEFAULT_LOCALE, type AcceptedLocale } from '@polar-sh/i18n'

interface MeteredRateProps {
  amount: number
  currency: string
  locale?: AcceptedLocale
  discount?: schemas['CheckoutPublic']['discount']
}

// A per-unit rate, struck through and restated when a percentage discount
// applies. Shared so a price and its tier rows can never disagree.
const MeteredRate = ({
  amount,
  currency,
  locale = DEFAULT_LOCALE,
  discount,
}: MeteredRateProps) => {
  const format = formatCurrency('subcent', locale)
  const discountedAmount =
    discount && 'basis_points' in discount
      ? amount * (1 - discount.basis_points / 10000)
      : null

  if (discountedAmount === null) {
    return <>{format(amount, currency)}</>
  }

  return (
    <>
      <span className="dark:text-polar-500 text-gray-400 line-through">
        {format(amount, currency)}
      </span>
      <span>{format(discountedAmount, currency)}</span>
    </>
  )
}

export default MeteredRate
