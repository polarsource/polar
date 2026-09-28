import { schemas } from '@polar-sh/client'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewTable } from './ReviewTable'

const state: { operation: Partial<schemas['MerchantMigrationOperation']> } = {
  operation: {},
}
const importCatalog = { mutate: vi.fn(), isPending: false, isError: false }
const precheck = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
}
const view = vi.fn()

vi.mock('@/hooks/queries/merchantMigrations', async (importOriginal) => ({
  ...(await importOriginal()),
  invalidateMigrationRecords: vi.fn(),
  useMerchantMigration: () => ({
    data: { id: 'migration_1', operation: state.operation },
  }),
  useMigrationRecords: () => ({
    isLoading: false,
    isError: false,
    data: { items: [], pagination: { max_page: 1, total_count: 0 } },
  }),
  useImportMerchantMigrationCatalog: () => importCatalog,
  useRunMerchantMigrationPrecheck: () => precheck,
}))

vi.mock('./recordSummary', () => ({
  useRecordSummary: () => ({
    counts: {},
    attentionCount: 0,
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('./ReviewTableView', () => ({
  ReviewTableView: (props: Record<string, unknown>) => {
    view(props)
    return null
  },
}))

const renderedProps = () => view.mock.lastCall?.[0]

describe('ReviewTable', () => {
  beforeEach(() => {
    view.mockClear()
    precheck.isError = false
    precheck.error = null
  })

  it('keeps preparing locked while an import is making progress', () => {
    state.operation = { kind: 'import', status: 'running', stalled: false }
    render(<ReviewTable migrationId="migration_1" />)

    expect(renderedProps().importing).toBe(true)
    expect(renderedProps().importError).toBeUndefined()
  })

  it('lets the merchant prepare again once an import stalls', () => {
    state.operation = { kind: 'import', status: 'running', stalled: true }
    render(<ReviewTable migrationId="migration_1" />)

    expect(renderedProps().importing).toBe(false)
    expect(renderedProps().importError).toMatch(/stalled/i)
    expect(renderedProps().stalled).toBe(false)
  })

  it('shows a failed refresh start after an import', () => {
    state.operation = { kind: 'import', status: 'done', stalled: false }
    precheck.isError = true
    precheck.error = new Error('Refresh already running.')
    render(<ReviewTable migrationId="migration_1" />)

    expect(renderedProps().refreshError).toBe('Refresh already running.')
  })
})
