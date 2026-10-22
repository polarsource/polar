import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { catalogVersions } from './catalogVersions'

const catalog = (
  id: string,
  published_at: string,
  status: schemas['Catalog']['status'] = 'archived',
): schemas['Catalog'] => ({
  id,
  created_at: published_at,
  modified_at: null,
  organization_id: 'org_1',
  version_hash: `${id}${'0'.repeat(63)}`,
  status,
  published_at,
  product_count: 1,
})

describe('catalogVersions', () => {
  it('labels catalogs in publishing order and lists the newest first', () => {
    const versions = catalogVersions([
      catalog('c', '2026-10-03T00:00:00Z', 'live'),
      catalog('a', '2026-10-01T00:00:00Z'),
      catalog('b', '2026-10-02T00:00:00Z'),
    ])

    expect(
      versions.map(({ catalog, label, shortHash }) => [
        catalog.id,
        label,
        shortHash,
      ]),
    ).toEqual([
      ['c', 'v3', 'c000000'],
      ['b', 'v2', 'b000000'],
      ['a', 'v1', 'a000000'],
    ])
  })
})
