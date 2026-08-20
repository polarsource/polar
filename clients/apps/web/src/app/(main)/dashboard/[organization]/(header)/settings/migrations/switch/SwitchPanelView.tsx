'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { schemas } from '@polar-sh/client'
import { Alert, Button, DataTable, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { headerCheckState, isRowSelected, SelectionState } from '../selection'
import { SwitchRecordModal } from './SwitchRecordModal'
import { SwitchStatusTabs } from './SwitchStatusTabs'
import { SwitchSummary } from './SwitchSummary'
import { buildSwitchColumns } from './switchColumns'
import {
  SWITCH_EMPTY_MESSAGES,
  SWITCH_UNDONE_WARNING,
  SwitchFilter,
} from './switchCopy'
import { SwitchRow } from './switchRows'

const numberFormat = new Intl.NumberFormat('en-US')

interface Props {
  report: schemas['MerchantMigrationCutoverReport']
  filter: SwitchFilter
  onFilterChange: (filter: SwitchFilter) => void
  rows: SwitchRow[]
  page: number
  pageSize: number
  pageCount: number
  rowCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  selection: SelectionState
  switchCount: number
  switchableTotal: number
  canSelectAll: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  onSwitch: () => void
  switching: boolean
  switchError?: string
}

export function SwitchPanelView({
  report,
  filter,
  onFilterChange,
  rows,
  page,
  pageSize,
  pageCount,
  rowCount,
  onPageChange,
  onPageSizeChange,
  selection,
  switchCount,
  switchableTotal,
  canSelectAll,
  onToggle,
  onToggleAll,
  onSwitch,
  switching,
  switchError,
}: Props) {
  const [openRow, setOpenRow] = useState<SwitchRow | null>(null)
  const [confirming, setConfirming] = useState(false)

  const running = report.running || switching
  const buttonLabel = running
    ? 'Switching…'
    : switchCount > 0
      ? `Switch ${numberFormat.format(switchCount)} subscriptions`
      : 'Switch subscriptions'

  const columns = useMemo(
    () =>
      buildSwitchColumns({
        isSelected: (id) => isRowSelected(selection, id),
        headerState: canSelectAll
          ? headerCheckState(selection)
          : 'unchecked',
        canSelectAll,
        onToggle,
        onToggleAll,
      }),
    [canSelectAll, selection, onToggle, onToggleAll],
  )

  const pagination: PaginationState = { pageIndex: page - 1, pageSize }
  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    if (next.pageSize !== pageSize) {
      onPageSizeChange(next.pageSize)
      return
    }
    onPageChange(next.pageIndex + 1)
  }

  return (
    <Box as="section" flexDirection="column" rowGap="xl">
      {switchError && (
        <Alert
          variant="danger"
          title="We couldn't switch these subscriptions"
          description={switchError}
        />
      )}

      <SwitchSummary report={report} />

      <Box flexDirection="column" rowGap="m">
        <Box
          alignItems="center"
          justifyContent="between"
          columnGap="m"
          rowGap="s"
          flexWrap="wrap"
        >
          <Box maxWidth="100%" overflowX="auto">
            <SwitchStatusTabs
              value={filter}
              counts={{
                all: report.total,
                skipped: report.skipped,
                failed: report.failed,
                moved: report.moved,
              }}
              onChange={onFilterChange}
            />
          </Box>
          <Button
            size="sm"
            onClick={() => setConfirming(true)}
            disabled={running || switchCount <= 0}
          >
            {buttonLabel}
          </Button>
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
              {SWITCH_EMPTY_MESSAGES[filter]}
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

      <ConfirmModal
        isShown={confirming}
        hide={() => setConfirming(false)}
        title={`Switch ${numberFormat.format(switchCount)} subscriptions?`}
        description={SWITCH_UNDONE_WARNING}
        destructive
        destructiveText={`Switch ${numberFormat.format(switchCount)} subscriptions`}
        onConfirm={onSwitch}
      />

      <InlineModal
        isShown={openRow !== null}
        hide={() => setOpenRow(null)}
        modalContent={
          openRow ? (
            <SwitchRecordModal row={openRow} onClose={() => setOpenRow(null)} />
          ) : (
            <Box />
          )
        }
      />
    </Box>
  )
}
