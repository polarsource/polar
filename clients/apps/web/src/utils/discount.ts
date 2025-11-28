import { schemas } from '@polar-sh/client'
import { formatCurrency, formatPercentage } from './formatters'

type CheckoutDiscount =
  | schemas['CheckoutDiscountFixedOnceForeverDuration']
  | schemas['CheckoutDiscountFixedRepeatDuration']
  | schemas['CheckoutDiscountPercentageOnceForeverDuration']
  | schemas['CheckoutDiscountPercentageRepeatDuration']

const isDiscountFixed = (
  discount: CheckoutDiscount,
): discount is
  | schemas['CheckoutDiscountFixedOnceForeverDuration']
  | schemas['CheckoutDiscountFixedRepeatDuration'] => {
  return discount.type === 'fixed'
}

const isDiscountPercentage = (
  discount: CheckoutDiscount,
): discount is
  | schemas['CheckoutDiscountPercentageOnceForeverDuration']
  | schemas['CheckoutDiscountPercentageRepeatDuration'] => {
  return discount.type === 'percentage'
}

export const getDiscountDisplay = (discount: CheckoutDiscount): string => {
  if (isDiscountPercentage(discount)) {
    return formatPercentage(-discount.basis_points / 10000)
  }

  if (isDiscountFixed(discount)) {
    return formatCurrency(-discount.amount, discount.currency)
  }

  throw new Error('Unknown discount type')
}
