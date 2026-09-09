import { render } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { schemas } from '@polar-sh/client'

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit', () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Spinner: () => null,
}))

vi.mock('./ReviewTableView', () => ({
  ReviewTableView: vi.fn(() => null),
}))

vi.mock('./recordSummary', () => ({
  useRecordSummary: vi.fn(),
}))

vi.mock('@/hooks/queries/merchantMigrations', async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import('@/hooks/queries/merchantMigrations')
  return {
    isActiveMigrationOperation: actual.isActiveMigrationOperation,
    useMerchantMigration: vi.fn(),
    useMigrationRecords: vi.fn(),
    useRunMerchantMigrationPrecheck: vi.fn(),
    useImportMerchantMigrationCatalog: vi.fn(),
    invalidateMigrationRecords: vi.fn(),
  }
})

const { ReviewTableView } = await import('./ReviewTableView')
const {
  useMerchantMigration,
  useMigrationRecords,
  useRunMerchantMigrationPrecheck,
  useImportMerchantMigrationCatalog,
} = await import('@/hooks/queries/merchantMigrations')
const { useRecordSummary: recordSummary } = await import('./recordSummary')
const { ReviewTable } = await import('./ReviewTable')

const makeOperation = (
  overrides: Partial<schemas['MerchantMigrationOperation']> = {},
): schemas['MerchantMigrationOperation'] => ({
  status: 'running',
  stalled: false,
  error: null,
  ...overrides,
})

const makeMigration = (
  operation: schemas['MerchantMigrationOperation'] | null,
): schemas['MerchantMigration'] =>
  ({
    id: 'm1',
    organization_id: 'org-1',
    source_platform: 'stripe',
    step: 'pre_check',
    source_connected: true,
    source: null,
    operation,
  }) as unknown as schemas['MerchantMigration']

const STALLED_MESSAGE =
  "The refresh from Stripe hasn't made progress. Try again to resume."

type ReviewTableViewProps = {
  refreshError?: string
  refreshErrorVariant?: 'info' | 'warning' | 'danger' | 'success'
  rerunning?: boolean
}

const propsPassed = (): ReviewTableViewProps => {
  const calls = vi.mocked(ReviewTableView).mock.calls
  return calls[calls.length - 1][0] as ReviewTableViewProps
}

describe('ReviewTable refresh error surfacing', () => {
  beforeEach(() => {
    vi.mocked(ReviewTableView).mockClear()
    vi.mocked(useMerchantMigration).mockReset()
    vi.mocked(useMigrationRecords).mockReset()
    vi.mocked(useRunMerchantMigrationPrecheck).mockReset()
    vi.mocked(useImportMerchantMigrationCatalog).mockReset()
    vi.mocked(recordSummary).mockReset()

    vi.mocked(useMigrationRecords).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [], pagination: { max_page: 1, total_count: 0 } },
    } as unknown as ReturnType<typeof useMigrationRecords>)

    vi.mocked(recordSummary).mockReturnValue({
      counts: {},
      attentionCount: 0,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof recordSummary>)

    vi.mocked(useImportMerchantMigrationCatalog).mockReturnValue({
      isPending: false,
      isError: false,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useImportMerchantMigrationCatalog>)

    vi.mocked(useRunMerchantMigrationPrecheck).mockReturnValue({
      isPending: false,
      isError: false,
      error: null,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRunMerchantMigrationPrecheck>)
  })

  it('surfaces a stalled run as a warning and keeps retry enabled', () => {
    vi.mocked(useMerchantMigration).mockReturnValue({
      data: makeMigration(makeOperation({ stalled: true })),
    } as unknown as ReturnType<typeof useMerchantMigration>)

    render(<ReviewTable migrationId="m1" />)

    expect(propsPassed().refreshError).toBe(STALLED_MESSAGE)
    expect(propsPassed().refreshErrorVariant).toBe('warning')
    expect(propsPassed().rerunning).toBe(false)
  })

  it('surfaces a hard failure as danger with the server message', () => {
    vi.mocked(useMerchantMigration).mockReturnValue({
      data: makeMigration(
        makeOperation({ status: 'failed', error: 'Catalog read failed' }),
      ),
    } as unknown as ReturnType<typeof useMerchantMigration>)

    render(<ReviewTable migrationId="m1" />)

    expect(propsPassed().refreshError).toBe('Catalog read failed')
    expect(propsPassed().refreshErrorVariant).toBe('danger')
  })

  it('falls back to the danger fallback when a failed run has no error message', () => {
    vi.mocked(useMerchantMigration).mockReturnValue({
      data: makeMigration(makeOperation({ status: 'failed', error: null })),
    } as unknown as ReturnType<typeof useMerchantMigration>)

    render(<ReviewTable migrationId="m1" />)

    expect(propsPassed().refreshError).toBe(
      "We couldn't refresh from Stripe. Please try again.",
    )
    expect(propsPassed().refreshErrorVariant).toBe('danger')
  })

  it('surfaces a mutation error as danger with the mutation message', () => {
    vi.mocked(useMerchantMigration).mockReturnValue({
      data: makeMigration(null),
    } as unknown as ReturnType<typeof useMerchantMigration>)
    vi.mocked(useRunMerchantMigrationPrecheck).mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('Start failed'),
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRunMerchantMigrationPrecheck>)

    render(<ReviewTable migrationId="m1" />)

    expect(propsPassed().refreshError).toBe('Start failed')
    expect(propsPassed().refreshErrorVariant).toBe('danger')
  })

  it('prefers the mutation error over a stalled op when both are present', () => {
    vi.mocked(useMerchantMigration).mockReturnValue({
      data: makeMigration(makeOperation({ stalled: true })),
    } as unknown as ReturnType<typeof useMerchantMigration>)
    vi.mocked(useRunMerchantMigrationPrecheck).mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('Start failed'),
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRunMerchantMigrationPrecheck>)

    render(<ReviewTable migrationId="m1" />)

    expect(propsPassed().refreshError).toBe('Start failed')
    expect(propsPassed().refreshErrorVariant).toBe('danger')
  })

  it('clears the alert when the operation finished cleanly', () => {
    vi.mocked(useMerchantMigration).mockReturnValue({
      data: makeMigration(makeOperation({ status: 'done' })),
    } as unknown as ReturnType<typeof useMerchantMigration>)

    render(<ReviewTable migrationId="m1" />)

    expect(propsPassed().refreshError).toBeUndefined()
    expect(propsPassed().refreshErrorVariant).toBe('danger')
  })

  it('clears the alert when there is no operation', () => {
    vi.mocked(useMerchantMigration).mockReturnValue({
      data: makeMigration(null),
    } as unknown as ReturnType<typeof useMerchantMigration>)

    render(<ReviewTable migrationId="m1" />)

    expect(propsPassed().refreshError).toBeUndefined()
  })
})
