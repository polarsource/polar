import { describe, expect, test } from 'vitest'
import { selectFields } from '@/utils/fields'

const product = {
  id: 'prod-1',
  name: 'Pro',
  is_archived: false,
  metadata: { plan: 'pro', tier: 2 },
  prices: [
    { id: 'price-1', price_amount: 1000, price_currency: 'usd' },
    { id: 'price-2', price_amount: 0, price_currency: 'usd' },
  ],
}

const selected = (result: unknown, fields: string) => {
  const selection = selectFields(result, fields)
  if (selection._tag !== 'Selected') throw new Error('expected a selection')
  return selection.value
}

describe('selectFields', () => {
  test('keeps only the requested fields, in the order asked for', () => {
    expect(JSON.stringify(selected(product, 'name, id'))).toBe(
      '{"name":"Pro","id":"prod-1"}',
    )
  })

  test('reaches into nested objects and lists with dots', () => {
    expect(selected(product, 'id,prices.price_amount,metadata.plan')).toEqual({
      id: 'prod-1',
      prices: [{ price_amount: 1000 }, { price_amount: 0 }],
      metadata: { plan: 'pro' },
    })
  })

  test('keeps a whole field when it is asked for both whole and in part', () => {
    expect(selected(product, 'prices.id,prices')).toEqual({
      prices: product.prices,
    })
  })

  test('applies to every item of a list and keeps the pagination', () => {
    const list = {
      items: [product, { ...product, id: 'prod-2', name: 'Free' }],
      pagination: { total_count: 2, max_page: 1 },
    }
    expect(selected(list, 'id,name')).toEqual({
      items: [
        { id: 'prod-1', name: 'Pro' },
        { id: 'prod-2', name: 'Free' },
      ],
      pagination: { total_count: 2, max_page: 1 },
    })
  })

  test('treats a record with its own items as one record, not a list', () => {
    const order = { id: 'order-1', items: [{ label: 'Pro', amount: 1000 }] }
    expect(selected(order, 'id,items.label')).toEqual({
      id: 'order-1',
      items: [{ label: 'Pro' }],
    })
  })

  test('says which nested fields matched nothing, and still selects', () => {
    expect(
      selectFields(product, 'id,prices.price_amout,metadata.plan'),
    ).toEqual({
      _tag: 'Selected',
      value: { id: 'prod-1', prices: [{}, {}], metadata: { plan: 'pro' } },
      unmatched: [
        {
          field: 'prices.price_amout',
          parent: 'prices',
          available: ['id', 'price_amount', 'price_currency'],
        },
      ],
    })
  })

  test('cannot check a nested field when there is nothing under its parent', () => {
    const selection = selectFields({ id: 'prod-1', prices: [] }, 'prices.any')
    expect(selection).toMatchObject({ _tag: 'Selected', unmatched: [] })
  })

  test('reports fields that do not exist, with the ones that do', () => {
    expect(selectFields(product, 'id,nme,price')).toEqual({
      _tag: 'UnknownFields',
      unknown: ['nme', 'price'],
      available: ['id', 'name', 'is_archived', 'metadata', 'prices'],
    })
  })

  test('accepts any field when there is nothing to check it against', () => {
    const empty = { items: [], pagination: { total_count: 0, max_page: 0 } }
    expect(selected(empty, 'id,anything')).toEqual(empty)
  })

  test('leaves the result alone without fields or for plain values', () => {
    expect(selected(product, ' , ')).toBe(product)
    expect(selected('text', 'id')).toBe('text')
  })
})
