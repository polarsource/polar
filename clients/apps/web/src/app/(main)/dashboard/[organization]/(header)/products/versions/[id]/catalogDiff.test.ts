import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { diffBenefits, diffCatalog } from './catalogDiff'

const benefit = (
  id: string,
  externalId: string | null,
  description: string,
): schemas['Benefit'] =>
  ({
    id,
    external_id: externalId,
    description,
    type: 'feature_flag',
  }) as schemas['Benefit']

describe('diffBenefits', () => {
  it('returns nothing when the benefits are the same rows', () => {
    const beta = benefit('b1', 'beta', 'Beta access')
    expect(diffBenefits([beta], [beta])).toEqual([])
  })

  it('reports a new version of a benefit with the same external ID', () => {
    const before = benefit('c1', 'api-credits', '1,000 API calls')
    const after = benefit('c2', 'api-credits', '5,000 API calls')
    expect(diffBenefits([before], [after])).toEqual([
      { type: 'updated', before, after },
    ])
  })

  it('reports added and removed benefits', () => {
    const beta = benefit('b1', 'beta', 'Beta access')
    const credits = benefit('c1', 'api-credits', '1,000 API calls')
    expect(diffBenefits([beta], [credits])).toEqual([
      { type: 'added', after: credits },
      { type: 'removed', before: beta },
    ])
  })

  it('matches benefits without an external ID by ID', () => {
    const manual = benefit('m1', null, 'Discord access')
    const other = benefit('m2', null, 'Discord access')
    expect(diffBenefits([manual], [manual])).toEqual([])
    expect(diffBenefits([manual], [other])).toEqual([
      { type: 'added', after: other },
      { type: 'removed', before: manual },
    ])
  })
})

describe('diffCatalog', () => {
  it('marks a product with a new row as changed', () => {
    expect(
      diffCatalog(
        [
          { external_id: 'pro', product_id: 'p2' },
          { external_id: 'starter', product_id: 's1' },
        ],
        [
          { external_id: 'pro', product_id: 'p1' },
          { external_id: 'starter', product_id: 's1' },
        ],
      ),
    ).toEqual([
      {
        row: { external_id: 'pro', product_id: 'p2' },
        change: 'changed',
        previousProductId: 'p1',
      },
      { row: { external_id: 'starter', product_id: 's1' }, change: null },
    ])
  })
})
