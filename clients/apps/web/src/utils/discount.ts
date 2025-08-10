import { schemas } from '@polar-sh/client'

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

// Utility functions for general discount objects
export const isDiscountFixedType = (
  discount: { type: string },
): boolean => {
  return discount.type === 'fixed'
}

export const isDiscountPercentageType = (
  discount: { type: string },
): boolean => {
  return discount.type === 'percentage'
}

/**
 * Filters a discount update payload to only include fields appropriate for the discount type.
 * For percentage discounts, excludes currency and amount fields.
 * For fixed discounts, excludes basis_points field.
 */
export const filterDiscountUpdatePayload = (
  discountUpdate: schemas['DiscountUpdate'],
): schemas['DiscountUpdate'] => {
  const { type } = discountUpdate

  if (!type) {
    // If no type is provided, return as-is
    return discountUpdate
  }

  if (type === 'percentage') {
    // For percentage discounts, exclude currency and amount
    const { currency, amount, ...filteredUpdate } = discountUpdate
    return filteredUpdate
  }

  if (type === 'fixed') {
    // For fixed discounts, exclude basis_points
    const { basis_points, ...filteredUpdate } = discountUpdate
    return filteredUpdate
  }

  return discountUpdate
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
    // Import formatCurrencyAndAmount dynamically to avoid issues in tests
    const { formatCurrencyAndAmount } = require('@polar-sh/ui/lib/money')
    return formatCurrencyAndAmount(-discount.amount, discount.currency, 0)
  }
  throw new Error('Unknown discount type')
}
