import {
  FreeProductPriceCreate,
  ProductFullMediasMixin,
  ProductMeterCycleMixin,
} from '@/components/Products/ProductForm/ProductForm'
import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

export const isLegacyRecurringPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['LegacyRecurringProductPrice'] => 'legacy' in price

export const hasLegacyRecurringPrices = (
  product: schemas['CheckoutProduct'],
): product is schemas['Product'] & {
  prices: schemas['LegacyRecurringProductPrice'][]
} => product.prices.some(isLegacyRecurringPrice)

export const isStaticPrice = (
  price: schemas['ProductPrice'],
): price is
  | schemas['ProductPriceFixed']
  | schemas['ProductPriceCustom']
  | schemas['ProductPriceSeatBased']
  | schemas['ProductPriceUnitBased'] =>
  ['fixed', 'custom', 'seat_based', 'unit_based'].includes(price.amount_type)

// A price is "free" when it's a fixed price of 0.
export const isFreePrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): boolean => price.amount_type === 'fixed' && price.price_amount === 0

// Surface a fixed price of 0 as the form's UI-only `free` price type so it displays and
// edits as "Free" when loading a product into the form.
type FreeFormPrice = Omit<
  schemas['ProductPriceFixed'],
  'amount_type' | 'price_amount'
> & { amount_type: 'free' }

export const productPriceToFormPrice = (
  price: schemas['ProductPrice'],
): schemas['ProductPrice'] | FreeFormPrice => {
  if (price.amount_type === 'fixed' && price.price_amount === 0) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { price_amount, ...rest } = price
    return { ...rest, amount_type: 'free' }
  }
  return price
}

// Inverse of `productPriceToFormPrice`: the form keeps `free` as a UI-only price type,
// so convert it back to a fixed price of 0 before sending to the API. The `free` price
// type does not exist in the API.
export const formPriceToApiPrice = (
  price: schemas['ProductCreate']['prices'][number] | FreeProductPriceCreate,
): schemas['ProductCreate']['prices'][number] =>
  price.amount_type === 'free'
    ? { ...price, amount_type: 'fixed', price_amount: 0 }
    : price

export const isMeteredPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['ProductPriceMeteredUnit'] =>
  price.amount_type === 'metered_unit'

export const isSeatBasedPrice = (
  price: schemas['ProductPrice'],
): price is schemas['ProductPriceSeatBased'] =>
  price.amount_type === 'seat_based'

export const isUnitBasedPrice = (
  price: schemas['ProductPrice'] | schemas['LegacyRecurringProductPrice'],
): price is schemas['ProductPriceUnitBased'] =>
  price.amount_type === 'unit_based'

const resolveUnitLabelForms = (
  unitLabel: schemas['ProductPriceUnitBased']['unit_label'] | undefined,
  locale?: string,
): Record<string, string> => {
  const labels = Object.fromEntries(
    Object.entries(unitLabel ?? {}).map(([key, forms]) => [
      key.replace(/_/g, '-').toLowerCase(),
      forms,
    ]),
  )
  if (locale) {
    const requested = locale.replace(/_/g, '-').toLowerCase()
    const language = requested.split('-')[0]
    const forms =
      labels[requested] ??
      labels[language] ??
      Object.entries(labels).find(
        ([key]) => key.split('-')[0] === language,
      )?.[1]
    if (forms) {
      return forms
    }
  }
  return labels['en'] ?? Object.values(labels)[0] ?? {}
}

export function getUnitLabels(
  price?: Pick<schemas['ProductPriceUnitBased'], 'unit_label'> | null,
  locale?: string,
): { unitLabel: string; unitLabelPlural: string } {
  const forms = resolveUnitLabelForms(price?.unit_label, locale)
  const unitLabel = forms['=1']?.trim() || forms['other']?.trim() || 'unit'
  const unitLabelPlural = forms['other']?.trim() || 'units'
  return { unitLabel, unitLabelPlural }
}

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
  'metadata' | 'prices'
> &
  ProductFullMediasMixin &
  ProductMeterCycleMixin & {
    metadata: { key: string; value: string | number | boolean }[]
    prices: (
      | schemas['ProductCreate']['prices'][number]
      | FreeProductPriceCreate
    )[]
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
      } = productPriceToFormPrice(price)
      return {
        ...priceRest,
        price_currency: price.price_currency as schemas['PresentmentCurrency'],
      }
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
