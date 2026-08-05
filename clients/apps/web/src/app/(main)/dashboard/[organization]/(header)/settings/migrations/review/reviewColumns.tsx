import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DataTableColumnDef } from '@polar-sh/orbit'
import { Check, Circle, Minus } from 'lucide-react'
import { ReactNode } from 'react'
import { reviewStatus } from './reviewStatus'
import { HeaderCheckState } from './reviewSelection'
import {
  entityLabelSingular,
  isImported,
  isSelectable,
  ReviewRow,
  ReviewScope,
  rowAmount,
} from './reviewRows'

interface ColumnContext {
  isSelected: (id: string) => boolean
  headerState: HeaderCheckState
  onToggle: (id: string) => void
  onToggleAll: () => void
}

const NAME_HEADER: Record<ReviewScope, string> = {
  all: 'Name',
  subscriptions: 'Customer',
  customers: 'Customer',
  products: 'Product',
}

export function buildReviewColumns(
  entity: ReviewScope,
  { isSelected, headerState, onToggle, onToggleAll }: ColumnContext,
): DataTableColumnDef<ReviewRow>[] {
  const columns: DataTableColumnDef<ReviewRow>[] = [
    {
      id: 'select',
      size: 44,
      header: () => (
        <HeaderCheckbox state={headerState} onToggle={onToggleAll} />
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
      id: 'name',
      size: 420,
      header: NAME_HEADER[entity],
      cell: ({ row }) => <NameCell row={row.original} />,
    },
  ]

  columns.push(
    {
      id: 'type',
      size: 140,
      header: 'Type',
      cell: ({ row }) => (
        <Text color="muted">{entityLabelSingular(row.original.entity)}</Text>
      ),
    },
    {
      id: 'status',
      size: 180,
      header: 'Import',
      cell: ({ row }) => <StatusCell row={row.original} />,
    },
    {
      id: 'amount',
      size: 150,
      header: () => (
        <Box width="100%" justifyContent="end">
          <Text variant="caption" color="muted">
            Amount
          </Text>
        </Box>
      ),
      cell: ({ row }) => <AmountCell row={row.original} />,
    },
  )

  return columns
}

function NameCell({ row }: { row: ReviewRow }) {
  return (
    <Box minWidth={0}>
      <Text truncate color={row.status === 'skipped' ? 'muted' : 'default'}>
        {row.title}
      </Text>
    </Box>
  )
}

function StatusCell({ row }: { row: ReviewRow }) {
  const { label, dot, labelColor } = reviewStatus(row)
  return (
    <Box alignItems="center" columnGap="s" minWidth={0}>
      <Box color={dot} flexShrink={0} alignItems="center">
        <Circle size={8} fill="currentColor" strokeWidth={0} />
      </Box>
      <Text truncate color={labelColor}>
        {label}
      </Text>
    </Box>
  )
}

function AmountCell({ row }: { row: ReviewRow }) {
  const amount = rowAmount(row)
  if (!amount) {
    return <Box />
  }
  return (
    <Box width="100%" justifyContent="end" alignItems="baseline" columnGap="xs">
      <Text monospace tabularNums align="right">
        {amount.money}
      </Text>
      {amount.interval && (
        <Text variant="caption" monospace color="muted">
          {amount.interval}
        </Text>
      )}
    </Box>
  )
}

function SelectCell({
  row,
  isSelected,
  onToggle,
}: {
  row: ReviewRow
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
}) {
  const id = row.record_id
  if (isImported(row)) {
    return (
      <Box color="text-secondary">
        <Check size={16} aria-hidden="true" />
      </Box>
    )
  }
  if (!isSelectable(row) || !id) {
    return <Box />
  }
  const selected = isSelected(id)
  return (
    <CheckboxBox
      checked={selected}
      ariaLabel={`Import ${row.title}`}
      onToggle={() => onToggle(id)}
    >
      {selected && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
    </CheckboxBox>
  )
}

function HeaderCheckbox({
  state,
  onToggle,
}: {
  state: HeaderCheckState
  onToggle: () => void
}) {
  return (
    <CheckboxBox
      checked={state === 'checked'}
      indeterminate={state === 'indeterminate'}
      ariaLabel="Select all"
      onToggle={onToggle}
    >
      {state === 'checked' && (
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
      )}
      {state === 'indeterminate' && (
        <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
      )}
    </CheckboxBox>
  )
}

function CheckboxBox({
  checked,
  indeterminate = false,
  ariaLabel,
  onToggle,
  children,
}: {
  checked: boolean
  indeterminate?: boolean
  ariaLabel: string
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <Box
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      tabIndex={0}
      width={18}
      height={18}
      borderRadius="s"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      alignItems="center"
      justifyContent="center"
      color="text-secondary"
      cursor={{ hover: 'pointer' }}
      onClick={(event) => {
        // The row itself opens the detail modal.
        event.stopPropagation()
        onToggle()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          onToggle()
        }
      }}
    >
      {children}
    </Box>
  )
}
