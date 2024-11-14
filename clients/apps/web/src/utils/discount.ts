import {
  CheckoutDiscountFixedOnceForeverDuration,
  CheckoutDiscountFixedRepeatDuration,
  CheckoutDiscountPercentageOnceForeverDuration,
  CheckoutDiscountPercentageRepeatDuration,
  CheckoutPublicDiscount,
  DiscountType,
} from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from '@polarkit/lib/money'

const isDiscountFixed = (
  discount: CheckoutPublicDiscount,
): discount is
  | CheckoutDiscountFixedOnceForeverDuration
  | CheckoutDiscountFixedRepeatDuration => {
  return discount.type === DiscountType.FIXED
}

const isDiscountPercentage = (
  discount: CheckoutPublicDiscount,
): discount is
  | CheckoutDiscountPercentageOnceForeverDuration
  | CheckoutDiscountPercentageRepeatDuration => {
  return discount.type === DiscountType.PERCENTAGE
}

const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
})

export const getDiscountDisplay = (
  discount: CheckoutPublicDiscount,
): string => {
  if (isDiscountPercentage(discount)) {
    return percentageFormatter.format(-discount.basis_points / 10000)
  }
  if (isDiscountFixed(discount)) {
    return formatCurrencyAndAmount(-discount.amount, discount.currency, 0)
  }
  throw new Error('Unknown discount type')
}
