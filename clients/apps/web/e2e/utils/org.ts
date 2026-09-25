import type { schemas } from '@polar-sh/client'
import { createHash } from 'node:crypto'
import { orgApi } from './api'
import type { ProductSpec } from './products'

type Discount = schemas['ListResource_Discount_']['items'][number]
type CustomField = schemas['ListResource_CustomField_']['items'][number]
type Meter = schemas['ListResource_Meter_']['items'][number]
export type DiscountSpec =
  | schemas['DiscountPercentageCreate']
  | schemas['DiscountFixedCreate']
export type CustomFieldSpec = schemas['CustomFieldCreateText']
export type MeterSpec = schemas['MeterCreate']

const search = async <T>(
  path: string,
  query: string,
  params: Record<string, string> = {},
) => {
  const search = new URLSearchParams({ query, limit: '100', ...params })
  return (await orgApi<{ items: T[] }>(`${path}?${search}`)).items
}

const create = <T>(path: string, body: unknown) =>
  orgApi<T>(path, { method: 'POST', body })

const specHash = (spec: ProductSpec) =>
  createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 12)

export const ensureProduct = async (spec: ProductSpec): Promise<string> => {
  const hash = specHash(spec)
  const sameName = (
    await search<schemas['Product']>('/v1/products/', spec.name, {
      is_archived: 'false',
    })
  )
    .filter((product) => product.name === spec.name)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const current = sameName.find((product) => product.metadata.e2e_spec === hash)
  for (const product of sameName.filter((product) => product !== current)) {
    await orgApi(`/v1/products/${product.id}`, {
      method: 'PATCH',
      body: { is_archived: true },
    })
  }
  if (current) return current.id
  const created = await create<schemas['Product']>('/v1/products/', {
    ...spec,
    metadata: { e2e_spec: hash },
  })
  return created.id
}

export const ensureDiscount = async (spec: DiscountSpec): Promise<Discount> =>
  (await search<Discount>('/v1/discounts/', spec.name)).find(
    (discount) => discount.code === spec.code,
  ) ?? create<Discount>('/v1/discounts/', spec)

export const ensureCustomField = async (
  spec: CustomFieldSpec,
): Promise<CustomField> =>
  (await search<CustomField>('/v1/custom-fields/', spec.slug)).find(
    (field) => field.slug === spec.slug,
  ) ?? create<CustomField>('/v1/custom-fields/', spec)

export const ensureMeter = async (spec: MeterSpec): Promise<Meter> =>
  (await search<Meter>('/v1/meters/', spec.name)).find(
    (meter) => meter.name === spec.name,
  ) ?? create<Meter>('/v1/meters/', spec)
