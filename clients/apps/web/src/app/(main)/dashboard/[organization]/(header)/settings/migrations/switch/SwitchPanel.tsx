'use client'

import {
  useMigrationRecords,
  useMigrationSwitch,
  useStartMigrationSwitch,
} from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useState } from 'react'
import {
  SelectionState,
  selectedCount,
  selectionAfterSubmit,
  selectionPayload,
  toggleAll,
  toggleRow,
} from '../selection'
import { SwitchPanelView } from './SwitchPanelView'
import { SwitchFilter } from './switchCopy'

// Opt in, not out: switching bills customers and can't be undone, so nothing is
// picked until the merchant picks it.
const initialSwitchSelection: SelectionState = {
  mode: 'none',
  toggled: new Set(),
}

export function SwitchPanel({ migrationId }: { migrationId: string }) {
  const [filter, setFilter] = useState<SwitchFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selection, setSelection] = useState<SelectionState>(
    initialSwitchSelection,
  )

  const switchReport = useMigrationSwitch(migrationId)
  const running = switchReport.data?.running ?? false
  const records = useMigrationRecords(
    migrationId,
    {
      entity: 'subscriptions',
      importStatus: 'imported',
      ...(filter !== 'all' ? { cutoverStatus: filter } : {}),
      page,
      limit: pageSize,
    },
    // Follow the run: rows flip to their outcome as the worker chain lands.
    running ? 3000 : false,
  )
  const startSwitch = useStartMigrationSwitch(migrationId)

  const onFilterChange = (next: SwitchFilter) => {
    setFilter(next)
    setPage(1)
  }
  const onPageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }
  const onToggle = useCallback(
    (id: string) => setSelection((prev) => toggleRow(prev, id)),
    [],
  )
  const onToggleAll = useCallback(
    () => setSelection((prev) => toggleAll(prev)),
    [],
  )

  if (switchReport.isLoading || records.isLoading) {
    return (
      <Box padding="2xl" alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    )
  }

  if (switchReport.isError || records.isError || !switchReport.data) {
    return (
      <Alert
        variant="danger"
        title="We couldn't load your subscriptions"
        description="Something went wrong. Please refresh and try again."
      />
    )
  }

  const report = switchReport.data
  // Everything imported that Polar doesn't bill yet: what a switch could move.
  const switchableTotal = Math.max(0, report.total - report.moved)
  const switchCount = selectedCount(selection, switchableTotal)

  return (
    <SwitchPanelView
      report={report}
      filter={filter}
      onFilterChange={onFilterChange}
      rows={records.data?.items ?? []}
      page={page}
      pageSize={pageSize}
      pageCount={records.data?.pagination.max_page ?? 1}
      rowCount={records.data?.pagination.total_count ?? 0}
      onPageChange={setPage}
      onPageSizeChange={onPageSizeChange}
      selection={selection}
      switchCount={switchCount}
      switchableTotal={switchableTotal}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onSwitch={() => {
        const submitted = selection
        startSwitch.mutate(selectionPayload(submitted), {
          onSuccess: () =>
            setSelection((current) =>
              selectionAfterSubmit(submitted, current),
            ),
        })
      }}
      switching={startSwitch.isPending}
      switchError={
        startSwitch.isError
          ? startSwitch.error?.message ||
            'Something went wrong. Please try again.'
          : undefined
      }
    />
  )
}
