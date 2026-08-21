'use client'

import {
  useImportMerchantMigrationCatalog,
  useMigrationRecords,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useState } from 'react'
import { useRecordSummary } from './recordSummary'
import {
  selectionPayload,
  initialSelection,
  selectionAfterSubmit,
  SelectionState,
  toggleAll,
  toggleRow,
} from '../selection'
import { ReviewFilter } from './ReviewStatusTabs'
import { ReviewTableView } from './ReviewTableView'

export function ReviewTable({ migrationId }: { migrationId: string }) {
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selection, setSelection] = useState<SelectionState>(initialSelection)

  const records = useMigrationRecords(migrationId, {
    entity: 'subscriptions',
    page,
    limit: pageSize,
    ...(filter === 'attention' ? { reasonLevel: 'action_required' } : {}),
    ...(filter === 'skipped' ? { status: 'skipped' as const } : {}),
  })
  const {
    counts,
    attentionCount,
    isLoading: countsLoading,
    isError: countsError,
  } = useRecordSummary(migrationId)
  const importCatalog = useImportMerchantMigrationCatalog(migrationId)
  const rerunPrecheck = useRunMerchantMigrationPrecheck(migrationId)

  const onFilterChange = (next: ReviewFilter) => {
    setFilter(next)
    setPage(1)
  }

  const onPageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  // Stable so `buildReviewColumns` can actually be memoised.
  const toggle = useCallback(
    (id: string) => setSelection((prev) => toggleRow(prev, id)),
    [],
  )
  const onToggleAll = useCallback(
    () => setSelection((prev) => toggleAll(prev)),
    [],
  )

  if (records.isLoading || countsLoading) {
    return (
      <Box padding="2xl" alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    )
  }

  if (records.isError || countsError) {
    return (
      <Alert
        variant="danger"
        title="We couldn't load these records"
        description="Something went wrong. Please refresh and try again."
      />
    )
  }

  return (
    <ReviewTableView
      filter={filter}
      onFilterChange={onFilterChange}
      counts={counts}
      attentionCount={attentionCount}
      rows={records.data?.items ?? []}
      page={page}
      pageSize={pageSize}
      pageCount={records.data?.pagination.max_page ?? 1}
      rowCount={records.data?.pagination.total_count ?? 0}
      onPageChange={setPage}
      onPageSizeChange={onPageSizeChange}
      selection={selection}
      onToggle={toggle}
      onToggleAll={onToggleAll}
      onImport={() => {
        const submitted = selection
        importCatalog.mutate(selectionPayload(submitted), {
          onSuccess: () =>
            setSelection((current) => selectionAfterSubmit(submitted, current)),
        })
      }}
      importing={importCatalog.isPending}
      importError={
        importCatalog.isError
          ? importCatalog.error?.message ||
            'Something went wrong. Please try again.'
          : undefined
      }
      onRerunPrecheck={() => rerunPrecheck.mutate()}
      rerunning={rerunPrecheck.isPending}
      blockers={rerunPrecheck.data?.issues.filter(
        (issue) => issue.level === 'blocker',
      )}
    />
  )
}
