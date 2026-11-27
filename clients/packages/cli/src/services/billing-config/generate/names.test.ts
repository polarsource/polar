import { describe, expect, test } from 'vitest'
import { namesOf, unreadable } from '@/services/billing-config/generate/names'

const event = (name: string) => ({
  property: 'name',
  operator: 'eq',
  value: name,
})

const entries = (...ids: ReadonlyArray<string>) =>
  ids.map((external_id) => ({ external_id }))

describe('namesOf', () => {
  test('lists what the config declares and the events its meters count, once each', () => {
    const config = {
      meters: [
        {
          external_id: 'tool-calls',
          filter: {
            conjunction: 'and',
            clauses: [
              {
                conjunction: 'or',
                clauses: [event('tool_call'), event('search')],
              },
              { property: 'status', operator: 'eq', value: 'ok' },
            ],
          },
        },
        {
          external_id: 'searches',
          filter: { conjunction: 'and', clauses: [event('search')] },
        },
      ],
      benefits: entries('pro', 'team'),
      settings: { default_presentment_currency: 'usd' },
    }

    expect(namesOf(config)).toEqual({
      events: ['tool_call', 'search'],
      anyEvent: false,
      meters: ['tool-calls', 'searches'],
      benefits: ['pro', 'team'],
      products: [],
    })
  })

  test.each([
    ['has no filter', {}],
    [
      'filters on something else',
      {
        filter: {
          clauses: [
            { property: 'metadata.kind', operator: 'eq', value: 'llm' },
          ],
        },
      },
    ],
    [
      'matches names by pattern',
      {
        filter: {
          clauses: [{ property: 'name', operator: 'like', value: 'api.%' }],
        },
      },
    ],
  ])('says any event counts when a meter %s', (_, meter) => {
    const config = {
      meters: [
        { external_id: 'searches', filter: { clauses: [event('search')] } },
        { external_id: 'everything', ...meter },
      ],
    }

    expect(namesOf(config)).toMatchObject({
      events: ['search'],
      anyEvent: true,
    })
  })

  test('lists an ID that is declared twice once', () => {
    expect(namesOf({ products: entries('pro', 'pro') }).products).toEqual([
      'pro',
    ])
  })
})

describe('unreadable', () => {
  test.each([
    ['something that is not an object', null, 'It is not an object.'],
    [
      'a section that is not a list',
      { meters: 'x' },
      '"meters" is not a list.',
    ],
    [
      'an entry without an external ID',
      { benefits: [{ external_id: 'pro' }, { external_Id: 'team' }] },
      'benefits[1] has no external_id.',
    ],
  ])('says why for %s', (_, input, reason) => {
    expect(unreadable(input)).toBe(reason)
  })

  test('accepts a config with sections left out', () => {
    expect(unreadable({ meters: [] })).toBeUndefined()
  })
})
