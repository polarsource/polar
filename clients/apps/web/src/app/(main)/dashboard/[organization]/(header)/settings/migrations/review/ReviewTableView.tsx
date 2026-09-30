'use client'

import { Alert, Button, DataTable, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import {
  ReviewBulkTaxSlot,
  reviewTaxColumns,
  useBulkTaxVariant,
} from '../bulkTax/ReviewBulkTaxSlot'
import { CATALOG_READ_STALLED } from '../catalogReadCopy'
import { CatalogEmptyPanel } from './CatalogEmptyPanel'
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
import {
  CATALOG_REFRESH_COPY,
  remainingSubscriptionCount,
  reviewCatalogEmptyKind,
  reviewPrimaryAction,
} from './reviewCatalog'
import { ReviewRow } from './reviewRows'

const numberFormat = new Intl.NumberFormat('en-US')

interface Props {
  migrationId: string
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
  onContinue: () => void
  importing?: boolean
  importError?: string
  onRerunPrecheck?: () => void
  rerunning?: boolean
  stalled?: boolean
  refreshError?: string
  attentionCount: number
}

export function ReviewTableView({
  migrationId,
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
  onContinue,
  importing = false,
  importError,
  onRerunPrecheck,
  rerunning = false,
  stalled = false,
  refreshError,
  attentionCount,
}: Props) {
  const refreshing = rerunning && !stalled
  const rowTotal = remainingSubscriptionCount(
    counts.subscriptions.total,
    counts.subscriptions.imported,
  )
  const catalogEmpty = reviewCatalogEmptyKind(
    counts.subscriptions.total,
    counts.subscriptions.imported,
  )
  const selectableTotal = counts.subscriptions.selectable
  const importCount = selectedCount(selection, selectableTotal)
  const prepareLabel = importing
    ? 'Preparing…'
    : importCount > 0
      ? `Prepare ${numberFormat.format(importCount)} ${
          importCount === 1 ? 'subscription' : 'subscriptions'
        }`
      : 'Prepare subscriptions'
  const canPrepare = filter === 'all' || filter === 'to_prepare'
  const primaryAction = reviewPrimaryAction(
    selectableTotal,
    counts.subscriptions.ready,
  )
  const [openRow, setOpenRow] = useState<ReviewRow | null>(null)
  const bulkTaxVariant = useBulkTaxVariant()

  const columns = useMemo(
    () => [
      ...buildReviewColumns({
        isSelected: (id) => isRowSelected(selection, id),
        // The opt-out default reads as "all" even when no row can be picked,
        // which would show as ticked-but-disabled.
        headerState:
          selectableTotal > 0 ? headerCheckState(selection) : 'unchecked',
        // It flips every subscription, not this page, so gate it on the same scope.
        canSelectAll: selectableTotal > 0,
        onToggle,
        onToggleAll,
      }),
      ...reviewTaxColumns(bulkTaxVariant, migrationId),
    ],
    [
      selectableTotal,
      selection,
      onToggle,
      onToggleAll,
      bulkTaxVariant,
      migrationId,
    ],
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

  if (catalogEmpty) {
    return (
      <CatalogEmptyPanel
        kind={catalogEmpty}
        onRerunPrecheck={onRerunPrecheck}
        rerunning={rerunning}
        stalled={stalled}
        readError={refreshError}
      />
    )
  }

  return (
    <Box as="section" flexDirection="column" rowGap="xl">
      {rerunning && !refreshError && (
        <Alert
          variant="info"
          loading
          title={CATALOG_REFRESH_COPY.title}
          description={
            stalled ? CATALOG_READ_STALLED : CATALOG_REFRESH_COPY.description
          }
        />
      )}
      {refreshError && (
        <Alert
          variant="danger"
          title="We couldn't refresh from Stripe"
          description={refreshError}
        />
      )}
      {importError && (
        <Alert
          variant="danger"
          title="We couldn't prepare these subscriptions"
          description={importError}
        />
      )}
      <ReviewBulkTaxSlot
        variant={bulkTaxVariant}
        placement="above-table"
        migrationId={migrationId}
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
            <ReviewStatusTabs
              value={filter}
              counts={{
                all: rowTotal,
                to_prepare: selectableTotal,
                ready: counts.subscriptions.ready,
                attention: attentionCount,
                skipped: counts.subscriptions.skipped,
              }}
              onChange={onFilterChange}
            />
          </Box>
          <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
            <ReviewBulkTaxSlot
              variant={bulkTaxVariant}
              placement="toolbar"
              migrationId={migrationId}
              disabled={importing}
            />
            {onRerunPrecheck && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRerunPrecheck}
                disabled={refreshing || importing}
              >
                {refreshing ? 'Refreshing…' : 'Refresh from Stripe'}
              </Button>
            )}
            {primaryAction === 'continue' ? (
              <Button
                size="sm"
                onClick={onContinue}
                disabled={importing || refreshing}
              >
                {importing ? 'Continuing…' : 'Continue'}
              </Button>
            ) : canPrepare ? (
              <Button
                size="sm"
                onClick={onImport}
                disabled={importing || importCount <= 0}
              >
                {prepareLabel}
              </Button>
            ) : null}
          </Box>
        </Box>

        <Text variant="caption" color="muted">
          {primaryAction === 'continue'
            ? 'Every subscription that can move is already prepared. Continue to switch them to Polar.'
            : 'Preparing a subscription brings its customer and product to Polar. Polar starts billing only when you switch.'}
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
            <ReviewRecordModal
              row={openRow}
              migrationId={migrationId}
              onClose={() => setOpenRow(null)}
            />
          ) : (
            <Box />
          )
        }
      />
    </Box>
  )
}
