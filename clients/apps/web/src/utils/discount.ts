import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { formatPercentage } from './formatters'

type CheckoutDiscount =
  | schemas['CheckoutDiscountFixedOnceForeverDuration']
  | schemas['CheckoutDiscountFixedRepeatDuration']
  | schemas['CheckoutDiscountPercentageOnceForeverDuration']
  | schemas['CheckoutDiscountPercentageRepeatDuration']

export const isDiscountFixed = (
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
    return Object.entries(discount.amounts)
      .map(([currency, amount]) => formatCurrency('compact')(-amount, currency))
      .join(', ')
  }

  throw new Error('Unknown discount type')
}
