import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { latestVersions } from './products'

const product = (
  id: string,
  externalId: string | null,
  isCurrent: boolean,
  createdAt: string,
) =>
  ({
    id,
    external_id: externalId,
    is_current: isCurrent,
    created_at: createdAt,
  }) as schemas['Product']

describe('latestVersions', () => {
  it('keeps one product per external_id, preferring current then newest', () => {
    const result = latestVersions([
      product('pro-v1', 'pro', false, '2026-01-01T00:00:00Z'),
      product('pro-v2', 'pro', true, '2026-02-01T00:00:00Z'),
      product('legacy-v1', 'legacy', false, '2026-01-01T00:00:00Z'),
      product('legacy-v2', 'legacy', false, '2026-03-01T00:00:00Z'),
      product('manual', null, true, '2026-01-01T00:00:00Z'),
    ])

    expect(result.map(({ id }) => id).sort()).toEqual([
      'legacy-v2',
      'manual',
      'pro-v2',
    ])
  })
})
