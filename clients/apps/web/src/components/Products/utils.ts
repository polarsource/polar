import {
  Benefit,
  Product,
  ProductCreate,
  ProductPrice,
  ProductUpdate,
} from '@polar-sh/sdk'
import { ProductFullMediasMixin } from './ProductForm/ProductForm'

export const productUpdateToProduct = (
  productUpdate: ProductUpdate & ProductFullMediasMixin,
  benefits: Benefit[],
  product: Product,
): Product => {
  const { full_medias, ...productUpdateRest } = productUpdate
  return {
    ...product,
    name: productUpdateRest.name ?? '',
    description: productUpdateRest.description ?? '',
    prices:
      productUpdateRest.prices?.filter(
        (price): price is ProductPrice => 'type' in price,
      ) ?? [],
    medias: full_medias,
    benefits,
  }
}

export const productCreateToProduct = (
  organizationId: string,
  productCreate: ProductCreate & ProductFullMediasMixin,
  benefits: Benefit[],
): Product => {
  const { full_medias, ...productCreateRest } = productCreate
  return {
    id: organizationId + productCreate.name,
    ...productCreate,
    organization_id: organizationId,
    name: productCreateRest.name ?? '',
    description: productCreateRest.description ?? '',
    prices:
      productCreate.prices
        ?.map((price) => ({
          ...price,
          type: price.type ?? 'one_time',
        }))
        .filter((price): price is ProductPrice => 'type' in price) ?? [],
    medias: full_medias,
    benefits,
    created_at: new Date().toDateString(),
    modified_at: new Date().toDateString(),
    is_recurring:
      productCreate.prices.some((price) => price.type === 'recurring') ?? false,
    is_archived: false,
    attached_custom_fields: [],
    metadata: {},
  }
}
