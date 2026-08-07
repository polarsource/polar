'use client'

import {
  useImportMerchantMigrationCatalog,
  useMigrationEntityCounts,
  useMigrationRecords,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useState } from 'react'
import { ReviewScope } from './reviewRows'
import {
  importPayload,
  initialSelection,
  SelectionState,
  toggleAll,
  toggleRow,
} from './reviewSelection'
import { ReviewFilter } from './ReviewStatusTabs'
import { ReviewTableView } from './ReviewTableView'

export function ReviewTable({ migrationId }: { migrationId: string }) {
  const [entity, setEntity] = useState<ReviewScope>('all')
  const [filter, setFilter] = useState<ReviewFilter>('attention')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selection, setSelection] = useState<SelectionState>(initialSelection)

  const records = useMigrationRecords(migrationId, {
    ...(entity !== 'all' ? { entity } : {}),
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
  } = useMigrationEntityCounts(migrationId)
  const importCatalog = useImportMerchantMigrationCatalog(migrationId)
  const rerunPrecheck = useRunMerchantMigrationPrecheck(migrationId)

  const onEntityChange = (next: ReviewScope) => {
    setEntity(next)
    setPage(1)
  }

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
      entity={entity}
      onEntityChange={onEntityChange}
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
        importCatalog.mutate(importPayload(submitted), {
          // Imported rows stop being selectable, so a stale selection would
          // keep counting them. Keep anything picked while the import ran.
          onSuccess: () =>
            setSelection((current) =>
              current === submitted ? initialSelection : current,
            ),
        })
      }}
      importing={importCatalog.isPending}
      importResult={importCatalog.data}
      importError={importCatalog.error?.message}
      onRerunPrecheck={() => rerunPrecheck.mutate()}
      rerunning={rerunPrecheck.isPending}
      blockers={rerunPrecheck.data?.issues.filter(
        (issue) => issue.level === 'blocker',
      )}
    />
  )
}
