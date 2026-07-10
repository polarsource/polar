'use client'

import { CountEntity, EntityCount } from '@/hooks/queries/merchantMigrations'
import { Alert, Button, DataTable, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { useMemo } from 'react'
import { ReviewEntityTabs } from './ReviewEntityTabs'
import {
  EMPTY_MESSAGES,
  ReviewFilter,
  ReviewStatusTabs,
} from './ReviewStatusTabs'
import { ReviewSummary } from './ReviewSummary'
import { buildReviewColumns } from './reviewColumns'
import {
  headerCheckState,
  isRowSelected,
  selectedCount,
  SelectionState,
} from './reviewSelection'
import { ImportSummary, importResultText } from './importSummary'
import { ReviewRow, ReviewScope } from './reviewRows'

export type { ReviewFilter } from './ReviewStatusTabs'
export type { ImportSummary } from './importSummary'

interface Props {
  entity: ReviewScope
  onEntityChange: (entity: ReviewScope) => void
  filter: ReviewFilter
  onFilterChange: (filter: ReviewFilter) => void
  counts: Record<CountEntity, EntityCount>
  rows: ReviewRow[]
  page: number
  pageSize: number
  pageCount: number
  rowCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  selection: SelectionState
  onToggle: (id: string) => void
  onToggleAll: () => void
  onImport: () => void
  importing?: boolean
  importResult?: ImportSummary | null
  importError?: boolean
  onRerunPrecheck?: () => void
  rerunning?: boolean
}

export function ReviewTableView({
  entity,
  onEntityChange,
  filter,
  onFilterChange,
  counts,
  rows,
  page,
  pageSize,
  pageCount,
  rowCount,
  onPageChange,
  onPageSizeChange,
  selection,
  onToggle,
  onToggleAll,
  onImport,
  importing = false,
  importResult,
  importError = false,
  onRerunPrecheck,
  rerunning = false,
}: Props) {
  const tabCounts: Record<CountEntity, number> = {
    subscriptions:
      counts.subscriptions.importable + counts.subscriptions.skipped,
    products: counts.products.importable + counts.products.skipped,
    customers: counts.customers.importable + counts.customers.skipped,
  }
  const importableTotal =
    counts.subscriptions.importable +
    counts.products.importable +
    counts.customers.importable
  const skippedTotal =
    counts.subscriptions.skipped +
    counts.products.skipped +
    counts.customers.skipped

  const importCount = selectedCount(selection, importableTotal)
  const hasCatalog = importableTotal + skippedTotal > 0
  const allImported = hasCatalog && importableTotal === 0

  const columns = useMemo(
    () =>
      buildReviewColumns(entity, {
        isSelected: (id) => isRowSelected(selection, id),
        headerState: headerCheckState(selection),
        onToggle,
        onToggleAll,
      }),
    [entity, selection, onToggle, onToggleAll],
  )

  const pagination: PaginationState = { pageIndex: page - 1, pageSize }
  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    if (next.pageSize !== pageSize) {
      onPageSizeChange(next.pageSize)
    }
    onPageChange(next.pageIndex + 1)
  }

  if (!hasCatalog) {
    return (
      <Text variant="caption" color="muted">
        No records staged yet. Use &ldquo;Refresh from Stripe&rdquo; to scan
        Stripe.
      </Text>
    )
  }

  if (allImported) {
    return (
      <Alert
        variant="success"
        title="Catalog imported"
        description="All importable records are in Polar. Next: move saved cards."
      />
    )
  }

  return (
    <Box as="section" flexDirection="column" rowGap="xl">
      {importResult && (
        <Alert
          variant="success"
          title="Catalog imported"
          description={importResultText(importResult)}
        />
      )}
      {importError && (
        <Alert
          variant="danger"
          title="We couldn't import the catalog"
          description="Something went wrong. Please try again."
        />
      )}

      <ReviewSummary
        counts={counts}
        importCount={importCount}
        onImport={onImport}
        importing={importing}
      />

      <Box flexDirection="column" rowGap="m">
        <Box
          alignItems="center"
          justifyContent="between"
          columnGap="m"
          rowGap="s"
          flexWrap="wrap"
        >
          <Box maxWidth="100%" overflowX="auto">
            <ReviewStatusTabs value={filter} onChange={onFilterChange} />
          </Box>
          <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
            <Box maxWidth="100%" overflowX="auto">
              <ReviewEntityTabs
                value={entity}
                counts={tabCounts}
                onChange={onEntityChange}
              />
            </Box>
            {onRerunPrecheck && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRerunPrecheck}
                disabled={rerunning}
              >
                {rerunning ? 'Refreshing…' : 'Refresh from Stripe'}
              </Button>
            )}
          </Box>
        </Box>

        {rows.length === 0 ? (
          <Box
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            borderRadius="l"
            paddingVertical="2xl"
            justifyContent="center"
          >
            <Text variant="caption" color="muted">
              {EMPTY_MESSAGES[filter]}
            </Text>
          </Box>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            rowCount={rowCount}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
            isLoading={false}
            getRowId={(row) => row.record_id ?? row.source_id}
          />
        )}
      </Box>
    </Box>
  )
}
