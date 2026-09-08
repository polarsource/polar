'use client'

import {
  isActiveMigrationOperation,
  useImportMerchantMigrationCatalog,
  useMerchantMigration,
  useMigrationRecords,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
import { getQueryClient } from '@/utils/api/query'
import { Alert, Spinner } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useEffect, useRef, useState } from 'react'
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

  const { data: migration } = useMerchantMigration(migrationId)
  const refreshing = isActiveMigrationOperation(migration?.operation)
  const pollMs = refreshing ? 2000 : false

  const records = useMigrationRecords(
    migrationId,
    {
      entity: 'subscriptions',
      page,
      limit: pageSize,
      excludeImportStatus: 'imported',
      ...(filter === 'to_prepare'
        ? {
            status: 'importable' as const,
            importStatus: 'pending' as const,
            dependenciesImported: false,
          }
        : {}),
      ...(filter === 'ready'
        ? {
            status: 'importable' as const,
            importStatus: 'pending' as const,
            dependenciesImported: true,
          }
        : {}),
      ...(filter === 'attention' ? { reasonLevel: 'action_required' } : {}),
      ...(filter === 'skipped' ? { status: 'skipped' as const } : {}),
    },
    pollMs,
  )
  const {
    counts,
    attentionCount,
    isLoading: countsLoading,
    isError: countsError,
  } = useRecordSummary(migrationId, pollMs)
  const importCatalog = useImportMerchantMigrationCatalog(migrationId)
  const rerunPrecheck = useRunMerchantMigrationPrecheck(migrationId)
  const wasRefreshing = useRef(false)

  useEffect(() => {
    if (refreshing) {
      wasRefreshing.current = true
      return
    }
    if (wasRefreshing.current) {
      wasRefreshing.current = false
      const client = getQueryClient()
      client.invalidateQueries({
        queryKey: ['merchantMigrationRecords', { id: migrationId }],
      })
      client.invalidateQueries({
        queryKey: ['merchantMigrationRecordSummary', { id: migrationId }],
      })
    }
  }, [refreshing, migrationId])

  const onFilterChange = (next: ReviewFilter) => {
    setFilter(next)
    setPage(1)
  }

  const onPageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

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
      rerunning={refreshing || rerunPrecheck.isPending}
      refreshError={
        migration?.operation?.status === 'failed'
          ? migration.operation.error ||
            "We couldn't refresh from Stripe. Please try again."
          : undefined
      }
    />
  )
}
