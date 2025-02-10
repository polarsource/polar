import { components } from '@polar-sh/client'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'

type CheckoutDiscount =
  | components['schemas']['CheckoutDiscountFixedOnceForeverDuration']
  | components['schemas']['CheckoutDiscountFixedRepeatDuration']
  | components['schemas']['CheckoutDiscountPercentageOnceForeverDuration']
  | components['schemas']['CheckoutDiscountPercentageRepeatDuration']

const isDiscountFixed = (
  discount: CheckoutDiscount,
): discount is
  | components['schemas']['CheckoutDiscountFixedOnceForeverDuration']
  | components['schemas']['CheckoutDiscountFixedRepeatDuration'] => {
  return discount.type === 'fixed'
}

const isDiscountPercentage = (
  discount: CheckoutDiscount,
): discount is
  | components['schemas']['CheckoutDiscountPercentageOnceForeverDuration']
  | components['schemas']['CheckoutDiscountPercentageRepeatDuration'] => {
  return discount.type === 'percentage'
}

const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
})

export const getDiscountDisplay = (discount: CheckoutDiscount): string => {
  if (isDiscountPercentage(discount)) {
    return percentageFormatter.format(-discount.basis_points / 10000)
  }
  if (isDiscountFixed(discount)) {
    return formatCurrencyAndAmount(-discount.amount, discount.currency, 0)
  }
  throw new Error('Unknown discount type')
}
