import { describe, expect, test } from 'vitest'
import { slugify, unkeyed } from '@/utils/billing-config/keys'

describe('slugify', () => {
  test.each([
    ['Pro Plan', 'pro-plan'],
    ['  Café — Team (Annual)  ', 'cafe-team-annual'],
    ['API calls / 1k', 'api-calls-1k'],
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
      ['p-1', 'pro-2'],
      ['p-2', 'pro-3'],
      ['m-1', 'pro'],
      ['b-1', 'benefit'],
    ])
  })
})
