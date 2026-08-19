import { DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatCurrency } from '@polar-sh/currency'
import { HeaderCheckState } from '../selection'
import { SelectCheckbox } from '../SelectCheckbox'
import { SwitchStatusIndicator } from './SwitchStatusIndicator'
import {
  intervalAbbreviation,
  isSwitchable,
  isSwitched,
  renewsLabel,
  SwitchRow,
} from './switchRows'

interface ColumnContext {
  isSelected: (id: string) => boolean
  headerState: HeaderCheckState
  canSelectAll: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
}

const formatAmount = formatCurrency('accounting', 'en-US')

export function buildSwitchColumns({
  isSelected,
  headerState,
  canSelectAll,
  onToggle,
  onToggleAll,
}: ColumnContext): DataTableColumnDef<SwitchRow>[] {
  return [
    {
      id: 'select',
      size: 44,
      header: () => (
        <HeaderCheckbox
          state={headerState}
          disabled={!canSelectAll}
          onToggle={onToggleAll}
        />
      ),
      cell: ({ row }) => (
        <SelectCell
          row={row.original}
          isSelected={isSelected}
          onToggle={onToggle}
        />
      ),
    },
    {
      id: 'customer',
      size: 320,
      header: 'Customer',
      cell: ({ row }) => (
        <Box minWidth={0}>
          <Text truncate>{row.original.title}</Text>
        </Box>
      ),
    },
    {
      id: 'plan',
      size: 150,
      header: () => (
        <Box width="100%" justifyContent="end">
          <Text variant="caption" color="muted">
            Plan
          </Text>
        </Box>
      ),
      cell: ({ row }) => <PlanCell row={row.original} />,
    },
    {
      id: 'renews',
      size: 140,
      header: 'Renews',
      cell: ({ row }) => <RenewsCell row={row.original} />,
    },
    {
      id: 'status',
      size: 170,
      header: 'Status',
      cell: ({ row }) => <SwitchStatusIndicator row={row.original} />,
    },
  ]
}

function PlanCell({ row }: { row: SwitchRow }) {
  if (row.amount == null || !row.currency) {
    return <Box />
  }
  const interval = intervalAbbreviation(row.recurring_interval)
  return (
    <Box width="100%" justifyContent="end" alignItems="baseline" columnGap="xs">
      <Text monospace tabularNums align="right">
        {formatAmount(row.amount, row.currency)}
      </Text>
      {interval && (
        <Text variant="caption" monospace color="muted">
          {interval}
        </Text>
      )}
    </Box>
  )
}

function RenewsCell({ row }: { row: SwitchRow }) {
  const label = renewsLabel(row)
  if (!label) {
    return <Text color="muted">—</Text>
  }
  return <Text color="muted">{label}</Text>
}

function SelectCell({
  row,
  isSelected,
  onToggle,
}: {
  row: SwitchRow
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
}) {
  const id = row.record_id
  // Already billed by Polar: shown ticked and locked, so the column stays a
  // column instead of a run of gaps.
  if (isSwitched(row)) {
    return (
      <SelectCheckbox
        checked
        disabled
        ariaLabel={`${row.title} has switched`}
      />
    )
  }
  if (!isSwitchable(row) || !id) {
    return (
      <SelectCheckbox
        checked={false}
        disabled
        ariaLabel={`${row.title} can't be switched`}
      />
    )
  }
  return (
    <SelectCheckbox
      checked={isSelected(id)}
      ariaLabel={`Switch ${row.title}`}
      onToggle={() => onToggle(id)}
    />
  )
}

function HeaderCheckbox({
  state,
  disabled,
  onToggle,
}: {
  state: HeaderCheckState
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <SelectCheckbox
      checked={
        state === 'indeterminate' ? 'indeterminate' : state === 'checked'
      }
      disabled={disabled}
      ariaLabel="Select all"
      onToggle={onToggle}
    />
  )
}
