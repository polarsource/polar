'use client'

import {
  invalidateMigrationRecords,
  isActiveMigrationOperation,
  useImportMerchantMigrationCatalog,
  useMerchantMigration,
  useMigrationRecords,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
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
  const operation = migration?.operation
  const active = isActiveMigrationOperation(operation)
  const importingOperation = active && operation?.kind === 'import'
  const refreshing = active && operation?.kind !== 'import'
  const pollMs = active ? 2000 : false

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
  const wasActive = useRef(false)
  const pendingSelection = useRef<SelectionState | null>(null)

  useEffect(() => {
    if (active) {
      wasActive.current = true
      return
    }
    if (wasActive.current) {
      wasActive.current = false
      invalidateMigrationRecords(migrationId)
    }
  }, [active, migrationId])

  useEffect(() => {
    if (operation?.kind !== 'import' || pendingSelection.current == null) {
      return
    }
    if (operation.status === 'done') {
      const submitted = pendingSelection.current
      pendingSelection.current = null
      setSelection((current) => selectionAfterSubmit(submitted, current))
      return
    }
    if (operation.status === 'failed' || operation.stalled) {
      pendingSelection.current = null
    }
  }, [operation])

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
  const stalled =
    !rerunPrecheck.isPending &&
    operation?.kind !== 'import' &&
    operation?.stalled === true
  const refreshError = rerunPrecheck.isError
    ? rerunPrecheck.error?.message ||
      "We couldn't start the refresh from Stripe. Please try again."
    : operation?.kind !== 'import' && operation?.status === 'failed'
      ? operation.error || "We couldn't refresh from Stripe. Please try again."
      : undefined
  const importFailed =
    operation?.kind === 'import' &&
    (operation.status === 'failed' || operation.stalled)
  const importError = importCatalog.isError
    ? importCatalog.error?.message ||
      "We couldn't prepare these subscriptions. Please try again."
    : importFailed
      ? operation?.status === 'failed'
        ? operation.error ||
          "We couldn't prepare these subscriptions. Please try again."
        : 'Preparing stalled with no progress. Please try again.'
      : undefined

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
      migrationId={migrationId}
      filter={filter}
      onFilterChange={onFilterChange}
      counts={counts}
      attentionCount={attentionCount}
      hasConnectedAccounts={migration?.source?.has_connected_accounts === true}
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
        rerunPrecheck.reset()
        importCatalog.mutate(selectionPayload(submitted), {
          onSuccess: () => {
            pendingSelection.current = submitted
          },
        })
      }}
      onContinue={() => {
        rerunPrecheck.reset()
        // Prepares nothing: the summary this button was picked from can be
        // stale, and new subscriptions shouldn't be prepared unasked.
        importCatalog.mutate({ recordIds: [] })
      }}
      importing={importCatalog.isPending || importingOperation}
      importError={importError}
      onRerunPrecheck={() => rerunPrecheck.mutate()}
      rerunning={refreshing || stalled || rerunPrecheck.isPending}
      stalled={stalled}
      refreshError={refreshError}
    />
  )
}
