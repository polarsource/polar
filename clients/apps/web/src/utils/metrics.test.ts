import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { getCatalogMarkers, getPeriodEnd } from './metrics'

const catalog = (
  published_at: string,
  name: string | null,
): schemas['Catalog'] => ({
  id: published_at,
  organization_id: 'org',
  created_at: published_at,
  modified_at: null,
  status: 'archived',
  published_at,
  name,
  parent_id: null,
})

describe('getCatalogMarkers', () => {
  const periods = [
    new Date('2026-10-01T00:00:00Z'),
    new Date('2026-10-02T00:00:00Z'),
    new Date('2026-10-03T00:00:00Z'),
  ]

  it('snaps each version to the period it was published in, oldest first', () => {
    const markers = getCatalogMarkers(periods, [
      catalog('2026-10-02T18:00:00Z', null),
      catalog('2026-10-02T09:00:00Z', 'Spring pricing'),
      catalog('2026-10-01T00:00:00Z', null),
    ])

    expect(markers).toEqual([
      {
        x: '2026-10-01T00:00:00.000Z',
        items: [{ prefix: 'Published', label: 'new version' }],
      },
      {
        x: '2026-10-02T00:00:00.000Z',
        items: [
          { prefix: 'Published', label: 'Spring pricing' },
          { prefix: 'Published', label: 'new version' },
        ],
      },
    ])
  })

  it('skips versions published before the first period', () => {
    expect(
      getCatalogMarkers(periods, [catalog('2026-09-30T23:59:59Z', null)]),
    ).toEqual([])
  })
})

describe('getPeriodEnd', () => {
  it('adds one interval', () => {
    expect(getPeriodEnd(new Date('2026-01-31T00:00:00Z'), 'week')).toEqual(
      new Date('2026-02-07T00:00:00Z'),
    )
  })
})
