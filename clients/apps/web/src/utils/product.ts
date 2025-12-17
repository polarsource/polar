import { ProductFullMediasMixin } from '@/components/Products/ProductForm/ProductForm'
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
  | schemas['ProductPriceFree']
  | schemas['ProductPriceSeatBased'] =>
  ['fixed', 'custom', 'free', 'seat_based'].includes(price.amount_type)

export const isMeteredPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['ProductPriceMeteredUnit'] =>
  price.amount_type === 'metered_unit'

export const isSeatBasedPrice = (
  price: schemas['ProductPrice'],
): price is schemas['ProductPriceSeatBased'] =>
  price.amount_type === 'seat_based'

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

export type ProductEditOrCreateForm = Omit<
  schemas['ProductCreate'],
  'metadata'
> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

export const productToCreateForm = (
  product: schemas['Product'],
): ProductEditOrCreateForm => {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // We want to omit a few fields from the product to create a new product form.
  // This approach somewhat wonky, the alternative is omitting them which forces us
  // to type cast which is not preferable.
  const {
    id,
    created_at,
    modified_at,
    is_archived,
    is_recurring,
    benefits,
    medias,
    prices,
    attached_custom_fields,
    metadata,
    ...productBase
  } = product
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return {
    ...productBase,
    name: `Copy of ${product.name}`,
    full_medias: product.medias.map((media) => ({ ...media })),
    prices: product.prices.map((price) => {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const {
        id,
        created_at,
        modified_at,
        product_id,
        is_archived,
        source,
        ...priceRest
      } = price
      return priceRest
      /* eslint-enable @typescript-eslint/no-unused-vars */
    }),
    attached_custom_fields: product.attached_custom_fields.map((field) => ({
      custom_field_id: field.custom_field_id,
      required: field.required,
    })),
    metadata: Object.entries(product.metadata).map(([key, value]) => ({
      key,
      value,
    })),
  }
}
