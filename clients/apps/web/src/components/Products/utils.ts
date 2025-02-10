import { schemas } from '@polar-sh/client'
import type { ProductFullMediasMixin } from './ProductForm/ProductForm'

const isExistingProductPrice = (
  price:
    | schemas['ExistingProductPrice']
    | schemas['ProductPriceOneTimeCustomCreate']
    | schemas['ProductPriceOneTimeFixedCreate']
    | schemas['ProductPriceOneTimeFreeCreate']
    | schemas['ProductPriceRecurringFixedCreate']
    | schemas['ProductPriceRecurringFreeCreate'],
): price is schemas['ExistingProductPrice'] => 'id' in price && price.id !== ''

const priceCreateUpdateToPrice = (
  price:
    | schemas['ProductPriceOneTimeCustomCreate']
    | schemas['ProductPriceOneTimeFixedCreate']
    | schemas['ProductPriceOneTimeFreeCreate']
    | schemas['ProductPriceRecurringFixedCreate']
    | schemas['ProductPriceRecurringFreeCreate'],
): schemas['ProductPrice'] => {
  const base = {
    id: '',
    created_at: new Date().toISOString(),
    modified_at: null,
    is_archived: false,
    product_id: '',
  }
  if (price.type === 'one_time') {
    if (price.amount_type === 'fixed') {
      return {
        ...base,
        ...price,
        price_amount: price.price_amount ?? 0,
        price_currency: price.price_currency ?? 'usd',
      }
    } else if (price.amount_type === 'custom') {
      return {
        ...base,
        ...price,
        price_currency: price.price_currency ?? 'usd',
        minimum_amount: price.minimum_amount ?? null,
        maximum_amount: price.maximum_amount ?? null,
        preset_amount: price.preset_amount ?? null,
      }
    } else if (price.amount_type === 'free') {
      return {
        ...base,
        ...price,
      }
    }
  } else if (price.type === 'recurring') {
    if (price.amount_type === 'fixed') {
      return {
        ...base,
        ...price,
        price_currency: price.price_currency ?? 'usd',
        recurring_interval: price.recurring_interval ?? 'month',
      }
    } else if (price.amount_type === 'free') {
      return {
        ...base,
        ...price,
      }
    }
  }

  return {
    ...base,
    type: 'one_time',
    amount_type: 'fixed',
    price_amount: 0,
    price_currency: 'usd',
  }
}

export const productUpdateToProduct = (
  productUpdate: schemas['ProductUpdate'] & ProductFullMediasMixin,
  benefits: schemas['Benefit'][],
  product: schemas['Product'],
): schemas['Product'] => {
  const { full_medias, ...productUpdateRest } = productUpdate
  return {
    ...product,
    name: productUpdateRest.name ?? '',
    description: productUpdateRest.description ?? '',
    prices:
      productUpdateRest.prices
        ?.map<
          schemas['ProductPrice']
        >((price) => (isExistingProductPrice(price) ? (price as schemas['ProductPrice']) : priceCreateUpdateToPrice(price)))
        .filter((price): price is schemas['ProductPrice'] => 'type' in price) ??
      [],
    medias: full_medias,
    benefits,
  }
}

export const productCreateToProduct = (
  organizationId: string,
  productCreate: schemas['ProductCreate'] & ProductFullMediasMixin,
  benefits: schemas['Benefit'][],
): schemas['Product'] => {
  const { full_medias, ...productCreateRest } = productCreate
  return {
    id: organizationId + productCreate.name,
    ...productCreate,
    organization_id: organizationId,
    name: productCreateRest.name ?? '',
    description: productCreateRest.description ?? '',
    prices:
      productCreate.prices
        ?.map<schemas['ProductPrice']>(priceCreateUpdateToPrice)
        .filter((price): price is schemas['ProductPrice'] => 'type' in price) ??
      [],
    medias: full_medias,
    benefits,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    is_recurring:
      productCreate.prices.some((price) => price.type === 'recurring') ?? false,
    is_archived: false,
    attached_custom_fields: [],
    metadata: {},
  }
}
