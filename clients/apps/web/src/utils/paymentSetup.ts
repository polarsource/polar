import { isFreePrice, isMeteredPrice } from '@/utils/product'

const FOREVER_FREE_BASIS_POINTS = 10_000

type PaymentSetupPrice = Parameters<typeof isFreePrice>[0]

type PaymentSetupDiscount = {
  type: string
  duration: string
  basis_points?: number | null
}

export type PaymentSetupSubscription = {
  amount: number
  prices: readonly PaymentSetupPrice[]
  discount: PaymentSetupDiscount | null
}

export const isPaymentSetupRequired = (
  subscription: PaymentSetupSubscription,
): boolean => {
  if (
    subscription.prices.length > 0 &&
    subscription.prices.every(isFreePrice)
  ) {
    return false
  }

  const hasMeteredPrice = subscription.prices.some(isMeteredPrice)
  if (
    subscription.discount == null &&
    subscription.amount === 0 &&
    !hasMeteredPrice
  ) {
    return false
  }

  const { discount } = subscription
  if (
    discount != null &&
    discount.type === 'percentage' &&
    discount.duration === 'forever' &&
    discount.basis_points === FOREVER_FREE_BASIS_POINTS
  ) {
    return false
  }

  return true
}
