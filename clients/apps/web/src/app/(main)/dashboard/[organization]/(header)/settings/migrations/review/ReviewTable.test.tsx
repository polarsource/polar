import { render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Operation = {
  status: 'pending' | 'running' | 'done' | 'failed'
  stalled: boolean
  error: string | null
} | null

const harness = vi.hoisted(() => ({
  migration: {
    data: undefined as { operation: Operation } | undefined,
    isPending: true,
    isError: false,
  },
  records: {
    isLoading: false,
    isError: false,
    data: { items: [], pagination: { max_page: 1, total_count: 0 } },
  },
  summary: {
    counts: {
      subscriptions: {
        entity: 'subscriptions' as const,
        total: 0,
        importable: 0,
        skipped: 0,
        imported: 0,
        ready: 0,
        action_required: 0,
        selectable: 0,
      },
    },
    attentionCount: 0,
    isLoading: false,
    isFetching: false,
    isError: false,
  },
  rerun: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as { message?: string } | null,
  },
}))

vi.mock('@/hooks/queries/merchantMigrations', async () => {
  const actual = await vi.importActual<
    typeof import('@/hooks/queries/merchantMigrations')
  >('@/hooks/queries/merchantMigrations')
  return {
    ...actual,
    invalidateMigrationRecords: () => undefined,
    useMerchantMigration: () => harness.migration,
    useMigrationRecords: () => harness.records,
    useImportMerchantMigrationCatalog: () => ({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    }),
    useRunMerchantMigrationPrecheck: () => harness.rerun,
  }
})

vi.mock('./recordSummary', () => ({
  useRecordSummary: () => harness.summary,
}))

vi.mock('@polar-sh/orbit', () => ({
  Text: ({
    as: Tag = 'span',
    children,
  }: {
    as?: 'span' | 'h3'
    children: ReactNode
  }) => <Tag>{children}</Tag>,
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Spinner: () => <div role="status" />,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

import { ReviewTable } from './ReviewTable'

const settledCounts = () => {
  harness.records.isLoading = false
  harness.records.isError = false
  harness.summary.isLoading = false
  harness.summary.isFetching = false
  harness.summary.isError = false
  harness.summary.counts.subscriptions.total = 0
  harness.summary.counts.subscriptions.imported = 0
  harness.migration.isPending = false
  harness.migration.isError = false
  harness.rerun.isPending = false
  harness.rerun.isError = false
}

describe('ReviewTable refresh on an empty catalog', () => {
  beforeEach(() => {
    harness.rerun.mutate.mockReset()
    settledCounts()
  })

  it('keeps refreshing after a reload while the Stripe scan is still running', () => {
    harness.migration.data = {
      operation: { status: 'pending', stalled: false, error: null },
    }

    render(<ReviewTable migrationId="mig_1" />)

    expect(
      screen.getByRole('heading', { name: 'Refreshing from Stripe' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Nothing to import' }),
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  })

  it('shows the empty result only once the scan has settled on nothing', () => {
    harness.migration.data = {
      operation: { status: 'done', stalled: false, error: null },
    }

    render(<ReviewTable migrationId="mig_1" />)

    expect(
      screen.getByRole('heading', { name: 'Nothing to import' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Refresh from Stripe' }),
    ).toBeEnabled()
  })

  it('does not treat a wiped catalog as empty before the operation is known', () => {
    harness.migration.isPending = true
    harness.migration.data = undefined

    render(<ReviewTable migrationId="mig_1" />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Nothing to import' }),
    ).toBeNull()
  })

  it('does not settle on empty while the post-scan counts are still loading', () => {
    harness.migration.data = {
      operation: { status: 'done', stalled: false, error: null },
    }
    harness.summary.isFetching = true

    render(<ReviewTable migrationId="mig_1" />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Nothing to import' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Refresh from Stripe' }),
    ).toBeNull()
  })
})
