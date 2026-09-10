import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import { currentPosition } from './steps'

function migration(
  step: schemas['MerchantMigrationStep'],
  extras: Partial<schemas['MerchantMigration']> = {},
): schemas['MerchantMigration'] {
  return {
    id: 'mig_1',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: null,
    organization_id: 'org_1',
    source_platform: 'stripe',
    step,
    source_connected: true,
    source: null,
    operation: null,
    ...extras,
  } as schemas['MerchantMigration']
}

describe('currentPosition', () => {
  it('keeps copy_cards on Card movement while cards are still moving', () => {
    expect(currentPosition(migration('copy_cards'), 'verify_cards')).toEqual({
      kind: 'step',
      index: 2,
    })
  })

  it('surfaces Switch once cards are done, including a retired uncovered step', () => {
    expect(
      currentPosition(migration('copy_cards'), 'resolve_uncovered'),
    ).toEqual({
      kind: 'step',
      index: 3,
    })
  })

  it('maps activate_subscriptions to Switch without a pan key', () => {
    expect(currentPosition(migration('activate_subscriptions'))).toEqual({
      kind: 'step',
      index: 3,
    })
  })
})
