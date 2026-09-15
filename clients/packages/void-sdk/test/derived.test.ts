import { expect, expectTypeOf, it } from 'vitest'
import {
  compile,
  count,
  createVoid,
  defineConfig,
  derive,
  event,
  first,
  meter,
} from '../src/index'

const opened = count('opened', event('checkout.opened'))
const sold = count('sold', event('order.created'))
const conversion = derive(
  'conversion',
  { opened, sold },
  '$sold / $opened * 100',
)

it('collects input reducers and events and compiles named dependencies', () => {
  const config = defineConfig({ schema: { conversion } })
  const ir = compile(config)
  expect(ir.events.map((e) => e.name)).toEqual([
    'checkout.opened',
    'order.created',
  ])
  expect(ir.reducers.map((r) => r.slug)).toEqual([
    'conversion',
    'opened',
    'sold',
  ])
  expect(ir.reducers[0]).toEqual({
    slug: 'conversion',
    aggregation: {
      func: 'derive',
      inputs: { opened: 'opened', sold: 'sold' },
      expression: '$sold / $opened * 100',
    },
  })
})

it('rejects nesting, record inputs, unnamed inputs and use on meters', () => {
  expect(() => {
    // @ts-expect-error Derived reducers cannot be inputs.
    derive('nested', { conversion }, '$conversion')
  }).toThrow('event scalar reducers')
  expect(() => {
    // @ts-expect-error Record reducers cannot be inputs.
    derive('record', { x: first('record', event('record')) }, '$x')
  }).toThrow('event scalar reducers')
  expect(() => {
    // @ts-expect-error Inputs must have keys.
    derive('unnamed', { x: count(event('x')) }, '$x')
  }).toThrow('event scalar reducers')
  expect(() => {
    // @ts-expect-error Derived reducers cannot be used on meters.
    meter('conversion', { reducer: conversion, price: { amount: 1 } })
  }).toThrow('metrics only')
  expect(() => derive('bad', { opened }, '$unknown')).toThrow('references')
})

it('preserves nulls in typed derived queries and forwards the month and grouping', async () => {
  const requests: URL[] = []
  const client = createVoid(defineConfig({ schema: { conversion, opened } }), {
    apiUrl: 'http://void',
    token: 'test',
    fetch: async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      requests.push(url)
      if (url.pathname.endsWith('/reducers'))
        return Response.json([
          {
            id: 'conversion-id',
            slug: 'conversion',
            type: 'scalar',
            created_at: '2026-01-01T00:00:00Z',
            aggregation: {
              ...conversion.aggregation,
              inputs: { opened: 'opened', sold: 'sold' },
            },
            filter: null,
          },
        ])
      if (url.pathname.endsWith('/metrics'))
        return Response.json({
          reducer_id: 'conversion-id',
          interval: 'month',
          series: [
            {
              external_identity_id: null,
              external_root_id: 'customer',
              total: null,
              periods: [{ timestamp: '2026-01-01T00:00:00Z', value: null }],
            },
          ],
        })
      throw new Error(`Unexpected request: ${url}`)
    },
  })
  const queries = client.as('customer').reducers
  expectTypeOf(queries.conversion.total).returns.toEqualTypeOf<
    Promise<number | null>
  >()
  expectTypeOf(queries.opened.total).returns.toEqualTypeOf<Promise<number>>()
  expect(await queries.conversion.total()).toBeNull()
  const series = await queries.conversion.usage({
    start: new Date('2026-01-01'),
    end: new Date('2026-02-01'),
    interval: 'month',
    groupBy: 'root',
  })
  expect(series[0]?.total).toBeNull()
  expect(series[0]?.periods[0]?.value).toBeNull()
  expect(requests.at(-1)?.searchParams.get('interval')).toBe('month')
  expect(requests.at(-1)?.searchParams.get('group_by')).toBe('external_root_id')
})
