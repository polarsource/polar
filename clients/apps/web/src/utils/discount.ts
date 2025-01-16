import {
  CheckoutDiscount,
  CheckoutDiscountFixedOnceForeverDuration,
  CheckoutDiscountFixedRepeatDuration,
  CheckoutDiscountPercentageOnceForeverDuration,
  CheckoutDiscountPercentageRepeatDuration,
  DiscountType,
} from '@polar-sh/api'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'

const isDiscountFixed = (
  discount: CheckoutDiscount,
): discount is
  | CheckoutDiscountFixedOnceForeverDuration
  | CheckoutDiscountFixedRepeatDuration => {
  return discount.type === DiscountType.FIXED
}

const isDiscountPercentage = (
  discount: CheckoutDiscount,
): discount is
  | CheckoutDiscountPercentageOnceForeverDuration
  | CheckoutDiscountPercentageRepeatDuration => {
  return discount.type === DiscountType.PERCENTAGE
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
