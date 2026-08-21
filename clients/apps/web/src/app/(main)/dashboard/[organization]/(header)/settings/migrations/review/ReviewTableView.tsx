'use client'

import { schemas } from '@polar-sh/client'
import { Alert, Button, DataTable, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { ReviewEntityTabs } from './ReviewEntityTabs'
import { ReviewRecordModal } from './ReviewRecordModal'
import {
  EMPTY_MESSAGES,
  ReviewFilter,
  ReviewStatusTabs,
} from './ReviewStatusTabs'
import { CountEntity, EntityCount } from './recordSummary'
import { buildReviewColumns } from './reviewColumns'
import {
  headerCheckState,
  isRowSelected,
  selectedCount,
  SelectionState,
} from '../selection'
import { ReviewRow, ReviewScope } from './reviewRows'

const numberFormat = new Intl.NumberFormat('en-US')

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
  importError?: string
  onRerunPrecheck?: () => void
  rerunning?: boolean
  blockers?: schemas['PrecheckIssue'][]
  attentionCount: number
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
  importError,
  onRerunPrecheck,
  rerunning = false,
  blockers = [],
  attentionCount,
}: Props) {
  const tabCounts: Record<CountEntity, number> = {
    subscriptions: counts.subscriptions.total,
    products: counts.products.total,
    customers: counts.customers.total,
  }
  const sum = (field: 'total' | 'skipped' | 'selectable') =>
    counts.subscriptions[field] +
    counts.products[field] +
    counts.customers[field]
  const rowTotal = sum('total')
  const skippedTotal = sum('skipped')
  // Rows already in Polar stay `importable` forever, so the pre-check total
  // can't serve as the selection ceiling.
  const selectableTotal = sum('selectable')

  const importCount = selectedCount(selection, selectableTotal)
  const importLabel = importing
    ? 'Importing…'
    : importCount > 0
      ? `Import ${numberFormat.format(importCount)} records`
      : 'Import records'
  const hasCatalog = rowTotal > 0
  const [openRow, setOpenRow] = useState<ReviewRow | null>(null)

  const columns = useMemo(
    () =>
      buildReviewColumns(entity, {
        isSelected: (id) => isRowSelected(selection, id),
        // The opt-out default reads as "all" even when no row can be picked,
        // which would show as ticked-but-disabled.
        headerState:
          selectableTotal > 0 ? headerCheckState(selection) : 'unchecked',
        // It flips the whole catalog, not this page, so gate it on the same scope.
        canSelectAll: selectableTotal > 0,
        onToggle,
        onToggleAll,
      }),
    [entity, selectableTotal, selection, onToggle, onToggleAll],
  )

  const pagination: PaginationState = { pageIndex: page - 1, pageSize }
  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    if (next.pageSize !== pageSize) {
      // Resets to the first page, so don't put the old one back.
      onPageSizeChange(next.pageSize)
      return
    }
    onPageChange(next.pageIndex + 1)
  }

  if (blockers.length > 0) {
    return (
      <Box flexDirection="column" rowGap="l">
        {blockers.map((blocker) => (
          <Alert
            key={blocker.code}
            variant="danger"
            title="This migration can't run"
            description={blocker.message}
          />
        ))}
      </Box>
    )
  }

  // Reaching this step means a scan already ran, so an empty ledger means
  // Stripe had nothing we can migrate, not that the merchant still has to scan.
  if (!hasCatalog) {
    return (
      <Box
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        paddingVertical="3xl"
        paddingHorizontal="xl"
        flexDirection="column"
        alignItems="center"
        rowGap="l"
        textAlign="center"
      >
        <Box flexDirection="column" rowGap="xs" alignItems="center">
          <Text variant="heading-xs" as="h3">
            Nothing to import
          </Text>
          <Text variant="caption" color="muted">
            We found no products, customers or subscriptions in Stripe that can
            move to Polar. If you have added some since, scan again.
          </Text>
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
    )
  }

  return (
    <Box as="section" flexDirection="column" rowGap="xl">
      {importError && (
        <Alert
          variant="danger"
          title="We couldn't import the catalog"
          description={importError}
        />
      )}

      <Box flexDirection="column" rowGap="m">
        <Box
          alignItems="center"
          justifyContent="between"
          columnGap="m"
          rowGap="s"
          flexWrap="wrap"
        >
          <Box maxWidth="100%" overflowX="auto">
            <ReviewStatusTabs
              value={filter}
              counts={{
                attention: attentionCount,
                skipped: skippedTotal,
                all: rowTotal,
              }}
              onChange={onFilterChange}
            />
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
            <Button
              size="sm"
              onClick={onImport}
              disabled={importing || importCount <= 0}
            >
              {importLabel}
            </Button>
          </Box>
        </Box>

        <Text variant="caption" color="muted">
          Subscriptions arrive paused; nothing is billed until cutover.
        </Text>

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
            getRowId={(row) =>
              row.record_id ?? `${row.source_id}:${row.currency}`
            }
            onRowClick={(row) => setOpenRow(row.original)}
          />
        )}
      </Box>

      <InlineModal
        isShown={openRow !== null}
        hide={() => setOpenRow(null)}
        modalContent={
          openRow ? (
            <ReviewRecordModal row={openRow} onClose={() => setOpenRow(null)} />
          ) : (
            <Box />
          )
        }
      />
    </Box>
  )
}
