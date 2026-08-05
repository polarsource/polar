'use client'

import { CountEntity, EntityCount } from '@/hooks/queries/merchantMigrations'
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
import { buildReviewColumns } from './reviewColumns'
import {
  headerCheckState,
  isRowSelected,
  selectedCount,
  SelectionState,
} from './reviewSelection'
import { ImportSummary, importResultText } from './importSummary'
import { isSelectable, ReviewRow, ReviewScope } from './reviewRows'

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
  const [openRow, setOpenRow] = useState<ReviewRow | null>(null)

  const columns = useMemo(
    () =>
      buildReviewColumns(entity, {
        isSelected: (id) => isRowSelected(selection, id),
        headerState: headerCheckState(selection),
        // Select-all flips the whole catalog, so hide it when this view offers
        // nothing to select.
        canSelectAll: rows.some(isSelectable),
        onToggle,
        onToggleAll,
      }),
    [entity, rows, selection, onToggle, onToggleAll],
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
            <Button
              size="sm"
              onClick={onImport}
              disabled={importing || importCount <= 0}
            >
              {importing
                ? 'Importing…'
                : `Import ${numberFormat.format(importCount)} records`}
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
            getRowId={(row) => row.record_id ?? row.source_id}
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
