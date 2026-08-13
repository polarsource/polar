import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DataTableColumnDef } from '@polar-sh/orbit'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'
import { SelectCheckbox } from '../SelectCheckbox'
import { HeaderCheckState } from '../selection'
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
  canSelectAll: boolean
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
  {
    isSelected,
    headerState,
    canSelectAll,
    onToggle,
    onToggleAll,
  }: ColumnContext,
): DataTableColumnDef<ReviewRow>[] {
  const columns: DataTableColumnDef<ReviewRow>[] = [
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
    return (
      <SelectCheckbox checked disabled ariaLabel={`${row.title} is imported`} />
    )
  }
  if (!isSelectable(row) || !id) {
    return (
      <SelectCheckbox
        checked={false}
        disabled
        ariaLabel={`${row.title} can't be imported`}
      />
    )
  }
  return (
    <SelectCheckbox
      checked={isSelected(id)}
      ariaLabel={`Import ${row.title}`}
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
