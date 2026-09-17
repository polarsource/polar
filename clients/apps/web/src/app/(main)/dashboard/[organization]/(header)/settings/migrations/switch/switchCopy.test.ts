import { describe, expect, it } from 'vitest'
import { switchRecordsParams } from './switchCopy'

describe('switchRecordsParams', () => {
  it('always lists prepared subscriptions', () => {
    expect(switchRecordsParams('all', 1, 20)).toEqual({
      entity: 'subscriptions',
      dependenciesImported: true,
      page: 1,
      limit: 20,
    })
  })

  it('adds the cutover status on a status tab', () => {
    expect(switchRecordsParams('moved', 2, 50)).toEqual({
      entity: 'subscriptions',
      dependenciesImported: true,
      cutoverStatus: 'moved',
      page: 2,
      limit: 50,
    })
  })
})
