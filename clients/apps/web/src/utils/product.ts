import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

export const hasIntervals = (
  product: schemas['ProductStorefront'] | schemas['CheckoutProduct'],
): [boolean, boolean, boolean, boolean, boolean] => {
  const hasDayInterval = product.prices.some(
    (price) => price.type === 'recurring' && price.recurring_interval === 'day',
  )
  const hasWeekInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' && price.recurring_interval === 'week',
  )
  const hasMonthInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' && price.recurring_interval === 'month',
  )
  const hasYearInterval = product.prices.some(
    (price) =>
      price.type === 'recurring' && price.recurring_interval === 'year',
  )
  const hasBothIntervals = hasMonthInterval && hasYearInterval

  return [
    hasDayInterval,
    hasWeekInterval,
    hasMonthInterval,
    hasYearInterval,
    hasBothIntervals,
  ]
}

export const isLegacyRecurringPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['LegacyRecurringProductPrice'] => 'legacy' in price

export const hasLegacyRecurringPrices = (
  product: schemas['ProductStorefront'] | schemas['CheckoutProduct'],
): product is schemas['Product'] & {
  prices: schemas['LegacyRecurringProductPrice'][]
} => product.prices.some(isLegacyRecurringPrice)

export const isStaticPrice = (
  price: schemas['ProductPrice'],
): price is
  | schemas['ProductPriceFixed']
  | schemas['ProductPriceCustom']
  | schemas['ProductPriceFree'] =>
  ['fixed', 'custom', 'free'].includes(price.amount_type)

export const isMeteredPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['ProductPriceMeteredUnit'] =>
  price.amount_type === 'metered_unit'

const _getProductById = async (
  api: Client,
  id: string,
): Promise<schemas['Product']> => {
  return unwrap(
    api.GET('/v1/products/{id}', {
      params: {
        path: {
          id,
        },
      },
      cache: 'no-store',
    }),
    {
      404: notFound,
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getProductById = cache(_getProductById)
