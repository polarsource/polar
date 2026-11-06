import { describe, expect, it } from 'vitest'
import { diffItems, diffValue } from './diff'

type Row = { external_id: string; deprecated?: boolean } & Record<
  string,
  unknown
>

describe('diff', () => {
  it('pairs a removed and an added price of the same kind', () => {
    const fixed = (amount: number) => ({
      amount_type: 'fixed',
      price_currency: 'usd',
      price_amount: amount,
    })
    const metered = { amount_type: 'metered_unit', meter: 'api' }
    expect(diffValue('prices', [fixed(100)], [fixed(200), metered])).toEqual([
      {
        change: 'changed',
        field: 'prices',
        before: fixed(100),
        after: fixed(200),
      },
      { change: 'added', field: 'prices', after: metered },
    ])
  })

  it('splits items into added, changed, removed and unchanged', () => {
    const { entries, unchanged } = diffItems<Row>(
      [
        { external_id: 'a', metadata: null },
        { external_id: 'b', name: 'B' },
        { external_id: 'c' },
      ],
      [
        { external_id: 'a', metadata: {} },
        { external_id: 'b', name: 'Bee' },
        { external_id: 'c', deprecated: true },
        { external_id: 'd', name: 'Dee', price: 5 },
      ],
      'name',
    )
    expect(unchanged.map(({ external_id }) => external_id)).toEqual(['a'])
    expect(entries.map(({ key, change }) => [key, change])).toEqual([
      ['b', 'changed'],
      ['d', 'added'],
      ['c', 'removed'],
    ])
    expect(entries[0].lines).toEqual([
      { change: 'changed', field: 'name', before: 'B', after: 'Bee' },
    ])
    expect(entries[1].lines).toEqual([
      { change: 'added', field: 'price', after: 5 },
    ])
  })
})
