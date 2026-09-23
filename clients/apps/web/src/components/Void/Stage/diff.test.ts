import { describe, expect, it } from 'vitest'
import { configurationDiff, emptyConfiguration, definitionKinds } from './diff'

describe('configurationDiff', () => {
  it('reports additions and removals across every definition kind', () => {
    for (const kind of definitionKinds) {
      const applied = {
        ...emptyConfiguration,
        [kind]: [{ slug: 'old', name: 'Old' }],
      }
      const staged = {
        ...emptyConfiguration,
        [kind]: [{ slug: 'new', name: 'New' }],
      }
      expect(configurationDiff(applied, staged)).toEqual([
        {
          kind,
          slug: 'new',
          action: 'added',
          fields: [{ path: 'name', before: undefined, after: 'New' }],
        },
        {
          kind,
          slug: 'old',
          action: 'removed',
          fields: [{ path: 'name', before: 'Old', after: undefined }],
        },
      ])
    }
  })

  it('shows only changed fields, preserving nested null and object transitions', () => {
    expect(
      configurationDiff(
        {
          ...emptyConfiguration,
          products: [
            {
              slug: 'pro',
              name: 'Pro',
              price: { amount: '20', currency: 'usd' },
              metadata: null,
            },
          ],
        },
        {
          ...emptyConfiguration,
          products: [
            {
              slug: 'pro',
              name: 'Pro',
              price: { amount: '25', currency: 'usd' },
              metadata: { enabled: true },
            },
          ],
        },
      ),
    ).toEqual([
      {
        kind: 'products',
        slug: 'pro',
        action: 'changed',
        fields: [
          { path: 'metadata', before: null, after: { enabled: true } },
          { path: 'price.amount', before: '20', after: '25' },
        ],
      },
    ])
  })

  it('ignores definition order, object-key order, product reference order and decimal formatting', () => {
    const applied = {
      ...emptyConfiguration,
      products: [
        {
          slug: 'pro',
          price: { amount: '20.00', currency: 'usd' },
          entitlements: ['a', 'b'],
          meters: ['requests', 'tokens'],
        },
      ],
      meters: [
        { slug: 'tokens', unit_amount: '0.0100' },
        { slug: 'requests', unit_amount: '1' },
      ],
    }
    const staged = {
      ...emptyConfiguration,
      products: [
        {
          slug: 'pro',
          meters: ['tokens', 'requests'],
          entitlements: ['b', 'a'],
          price: { currency: 'usd', amount: '20' },
        },
      ],
      meters: [
        { slug: 'requests', unit_amount: '1.0' },
        { slug: 'tokens', unit_amount: '0.01' },
      ],
    }
    expect(configurationDiff(applied, staged)).toEqual([])
    expect(applied.products[0].meters).toEqual(['requests', 'tokens'])
  })

  it('preserves array changes and distinguishes false, zero, null and missing', () => {
    const before = {
      ...emptyConfiguration,
      signals: [
        {
          slug: 'signal',
          enabled: true,
          enter_below: 1,
          optional: 'yes',
          when: ['a', 'b'],
        },
      ],
    }
    const after = {
      ...emptyConfiguration,
      signals: [
        {
          slug: 'signal',
          enabled: false,
          enter_below: 0,
          optional: null,
          when: ['b', 'a'],
        },
      ],
    }
    expect(configurationDiff(before, after)[0].fields).toEqual([
      { path: 'enabled', before: true, after: false },
      { path: 'enter_below', before: 1, after: 0 },
      { path: 'optional', before: 'yes', after: null },
      { path: 'when', before: ['a', 'b'], after: ['b', 'a'] },
    ])
  })

  it('reports a slug-only definition being added', () => {
    expect(
      configurationDiff(emptyConfiguration, {
        ...emptyConfiguration,
        entitlements: [{ slug: 'analytics' }],
      }),
    ).toEqual([
      { kind: 'entitlements', slug: 'analytics', action: 'added', fields: [] },
    ])
  })
})
