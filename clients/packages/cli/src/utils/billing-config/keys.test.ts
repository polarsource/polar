import { describe, expect, test } from 'vitest'
import {
  isExternalId,
  slugify,
  typedKey,
  unkeyed,
} from '@/utils/billing-config/keys'

describe('typedKey', () => {
  test.each([
    ['a', 'a'],
    ['Pro Plan', 'pro_plan'],
    ['pro-2', 'pro-2'],
    ['.', '.'],
    [':', ':'],
    ['pro.plan:v2', 'pro.plan:v2'],
    ['é', undefined],
    ['/', undefined],
  ])('%s → %s', (text, key) => {
    expect(typedKey(text)).toBe(key)
  })
})

describe('isExternalId', () => {
  test.each([
    ['pro_plan', true],
    ['confirmix.plan.free', true],
    ['a1:month', true],
    ['_pro', false],
    ['-pro', false],
    ['..', false],
  ])('%s → %s', (key, valid) => {
    expect(isExternalId(key)).toBe(valid)
  })
})

describe('slugify', () => {
  test.each([
    ['Pro Plan', 'pro_plan'],
    ['  Café — Team (Annual)  ', 'cafe_team_annual'],
    ['API calls / 1k', 'api_calls_1k'],
    ['🚀', ''],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name)).toBe(slug)
  })
})

describe('unkeyed', () => {
  test('suggests keys unique per resource type, after the keys already in use', () => {
    const skipped = [
      {
        resource: 'product',
        id: 'p-1',
        name: 'Pro',
        reason: 'missing_external_id',
      },
      {
        resource: 'product',
        id: 'p-2',
        name: 'PRO',
        reason: 'missing_external_id',
      },
      {
        resource: 'meter',
        id: 'm-1',
        name: 'Pro',
        reason: 'missing_external_id',
      },
      {
        resource: 'benefit',
        id: 'b-1',
        name: '🚀',
        reason: 'missing_external_id',
      },
      { resource: 'product', id: 'p-3', name: 'Old', reason: 'archived' },
    ]

    expect(
      unkeyed({ products: [{ external_id: 'pro' }] }, skipped).map(
        ({ id, suggestion }) => [id, suggestion],
      ),
    ).toEqual([
      ['p-1', 'pro_2'],
      ['p-2', 'pro_3'],
      ['m-1', 'pro'],
      ['b-1', 'benefit'],
    ])
  })

  test('describes how often a product bills', () => {
    const product = (
      id: string,
      recurring_interval: string | null,
      recurring_interval_count: number | null,
    ) => ({
      resource: 'product',
      id,
      name: 'Team',
      reason: 'missing_external_id',
      recurring_interval,
      recurring_interval_count,
    })

    expect(
      unkeyed({}, [
        product('p-1', 'month', 1),
        product('p-2', 'year', 1),
        product('p-3', 'month', 3),
        product('p-5', 'week', 3),
        product('p-6', 'day', 1),
        product('p-7', 'year', 2),
        product('p-4', null, null),
        {
          resource: 'meter',
          id: 'm-1',
          name: 'Calls',
          reason: 'missing_external_id',
          recurring_interval: null,
          recurring_interval_count: null,
        },
      ]).map(({ cadence }) => cadence),
    ).toEqual([
      'monthly',
      'yearly',
      'every 3 months',
      'every 3 weeks',
      'daily',
      'every 2 years',
      'one-time',
      undefined,
    ])
  })
})
