import { describe, expect, it } from 'vitest'
import { diffItems, diffValue } from './diff'

describe('diffValue', () => {
  it('lists added and removed list items, not the whole list', () => {
    expect(
      diffValue('benefits', ['sso', 'audit_log'], ['sso', 'priority']),
    ).toEqual([
      { sign: '-', field: 'benefits', before: 'audit_log' },
      { sign: '+', field: 'benefits', after: 'priority' },
    ])
  })

  it('pairs a removed and an added price of the same kind', () => {
    const fixed = (amount: number) => ({
      amount_type: 'fixed',
      price_currency: 'usd',
      price_amount: amount,
    })
    const metered = {
      amount_type: 'metered_unit',
      price_currency: 'usd',
      meter: 'api',
    }
    expect(diffValue('prices', [fixed(100)], [fixed(200), metered])).toEqual([
      { sign: '~', field: 'prices', before: fixed(100), after: fixed(200) },
      { sign: '+', field: 'prices', after: metered },
    ])
  })

  it('compares objects key by key', () => {
    expect(
      diffValue(
        'properties',
        { meter: 'api', units: 10, rollover: false },
        { meter: 'api', units: 15, rollover: false },
      ),
    ).toEqual([{ sign: '~', field: 'units', before: 10, after: 15 }])
  })

  it('treats null and empty as the same', () => {
    expect(diffValue('metadata', null, {})).toEqual([])
    expect(diffValue('description', null, 'New')).toEqual([
      { sign: '+', field: 'description', after: 'New' },
    ])
  })
})

describe('diffItems', () => {
  it('splits items into added, changed, removed and unchanged', () => {
    const before = [
      { external_id: 'a', name: 'A' },
      { external_id: 'b', name: 'B' },
      { external_id: 'c', name: 'C' },
    ]
    const after = [
      { external_id: 'a', name: 'A' },
      { external_id: 'b', name: 'Bee' },
      { external_id: 'c', name: 'C', deprecated: true },
      { external_id: 'd', name: 'D' },
    ]
    const { entries, unchanged } = diffItems(after, before)
    expect(unchanged).toEqual([{ external_id: 'a', name: 'A' }])
    expect(entries.map(({ key, change }) => [key, change])).toEqual([
      ['b', 'changed'],
      ['d', 'added'],
      ['c', 'removed'],
    ])
    expect(entries[1].lines).toEqual([{ sign: '+', field: 'name', after: 'D' }])
    expect(entries[2].lines).toEqual([
      { sign: '-', field: 'name', before: 'C' },
    ])
  })
})
