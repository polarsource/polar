import { Checkbox, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DataTableColumnDef } from '@polar-sh/orbit'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'
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
      cell: ({ row }) => <ReviewStatusIndicator row={row.original} />,
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
  // A row that can't be picked keeps a disabled box, so the column stays a
  // column instead of a run of gaps.
  if (isImported(row)) {
    return <SelectBox checked disabled ariaLabel={`${row.title} is imported`} />
  }
  if (!isSelectable(row) || !id) {
    return (
      <SelectBox
        checked={false}
        disabled
        ariaLabel={`${row.title} can't be imported`}
      />
    )
  }
  return (
    <SelectBox
      checked={isSelected(id)}
      ariaLabel={`Import ${row.title}`}
      onToggle={() => onToggle(id)}
    />
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
    <SelectBox
      checked={
        state === 'indeterminate' ? 'indeterminate' : state === 'checked'
      }
      ariaLabel="Select all"
      onToggle={onToggle}
    />
  )
}

function SelectBox({
  checked,
  disabled = false,
  ariaLabel,
  onToggle,
}: {
  checked: boolean | 'indeterminate'
  disabled?: boolean
  ariaLabel: string
  onToggle?: () => void
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={() => onToggle?.()}
      // The row itself opens the detail modal.
      onClick={(event) => event.stopPropagation()}
    />
  )
}
