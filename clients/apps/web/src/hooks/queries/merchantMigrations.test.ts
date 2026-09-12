import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockClient = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}))

vi.mock('@/utils/api/query', () => ({
  getQueryClient: () => mockClient,
}))

vi.mock('@/utils/client', () => ({
  api: {},
}))

import { invalidateMigrationRecords } from './merchantMigrations'

describe('invalidateMigrationRecords', () => {
  beforeEach(() => {
    mockClient.invalidateQueries.mockReset()
  })

  it('invalidates the migration detail, records, and summary', () => {
    invalidateMigrationRecords('mig_1')

    expect(mockClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchantMigration', { id: 'mig_1' }],
    })
    expect(mockClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchantMigrationRecords', { id: 'mig_1' }],
    })
    expect(mockClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchantMigrationRecordSummary', { id: 'mig_1' }],
    })
  })

  it('invalidates the migrations list so step transitions reach the list card', () => {
    invalidateMigrationRecords('mig_1')

    expect(mockClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchantMigrations'],
    })
  })

  it('issues exactly four invalidations per call', () => {
    invalidateMigrationRecords('mig_1')

    expect(mockClient.invalidateQueries).toHaveBeenCalledTimes(4)
  })

  it('keys the list invalidation by collection, not by migration id', () => {
    invalidateMigrationRecords('mig_2')

    expect(mockClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchantMigrations'],
    })
    expect(mockClient.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['merchantMigrations', { id: 'mig_2' }],
    })
  })
})
