import { formatCurrency } from '@polar-sh/currency'
import type { CheckoutDiscountFixedOnceForeverDuration } from '@polar-sh/sdk/models/components/checkoutdiscountfixedonceforeverduration'
import type { CheckoutDiscountFixedRepeatDuration } from '@polar-sh/sdk/models/components/checkoutdiscountfixedrepeatduration'
import type { CheckoutDiscountPercentageOnceForeverDuration } from '@polar-sh/sdk/models/components/checkoutdiscountpercentageonceforeverduration'
import type { CheckoutDiscountPercentageRepeatDuration } from '@polar-sh/sdk/models/components/checkoutdiscountpercentagerepeatduration'

type CheckoutDiscount =
  | CheckoutDiscountPercentageOnceForeverDuration
  | CheckoutDiscountFixedOnceForeverDuration
  | CheckoutDiscountPercentageRepeatDuration
  | CheckoutDiscountFixedRepeatDuration

const isDiscountFixed = (
  discount: CheckoutDiscount,
): discount is
  | CheckoutDiscountFixedOnceForeverDuration
  | CheckoutDiscountFixedRepeatDuration => {
  return discount.type === 'fixed'
}

const isDiscountPercentage = (
  discount: CheckoutDiscount,
): discount is
  | CheckoutDiscountPercentageOnceForeverDuration
  | CheckoutDiscountPercentageRepeatDuration => {
  return discount.type === 'percentage'
}

const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
})

export const getDiscountDisplay = (discount: CheckoutDiscount): string => {
  if (isDiscountPercentage(discount)) {
    return percentageFormatter.format(-discount.basisPoints / 10000)
  }
  if (isDiscountFixed(discount)) {
    return formatCurrency('compact')(-discount.amount, discount.currency, 0)
  }
  throw new Error('Unknown discount type')
}
