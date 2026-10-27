import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { getCatalogMarkers, getPeriodEnd } from './metrics'

const catalog = (
  published_at: string,
  name: string | null,
  version_hash: string,
): schemas['Catalog'] => ({
  id: version_hash,
  organization_id: 'org',
  created_at: published_at,
  modified_at: null,
  status: 'archived',
  published_at,
  name,
  version_hash,
})

describe('getCatalogMarkers', () => {
  const periods = [
    new Date('2026-10-01T00:00:00Z'),
    new Date('2026-10-02T00:00:00Z'),
    new Date('2026-10-03T00:00:00Z'),
  ]

  it('snaps each version to the period it was published in, oldest first', () => {
    const markers = getCatalogMarkers(periods, [
      catalog('2026-10-02T18:00:00Z', null, 'cccccccccc'),
      catalog('2026-10-02T09:00:00Z', 'Spring pricing', 'bbbbbbbbbb'),
      catalog('2026-10-01T00:00:00Z', null, 'aaaaaaaaaa'),
    ])

    expect(markers).toEqual([
      {
        x: '2026-10-01T00:00:00.000Z',
        items: [{ label: 'Version', detail: 'aaaaaaa' }],
      },
      {
        x: '2026-10-02T00:00:00.000Z',
        items: [
          { label: 'Spring pricing', detail: 'bbbbbbb' },
          { label: 'Version', detail: 'ccccccc' },
        ],
      },
    ])
  })

  it('skips versions published before the first period', () => {
    expect(
      getCatalogMarkers(periods, [
        catalog('2026-09-30T23:59:59Z', null, 'aaaaaaaaaa'),
      ]),
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
