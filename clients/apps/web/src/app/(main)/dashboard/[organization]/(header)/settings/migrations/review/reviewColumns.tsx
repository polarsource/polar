import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DataTableColumnDef } from '@polar-sh/orbit'
import { PaymentMethodLabel } from './PaymentMethodLabel'
import { PaymentMethodVariant } from './paymentMethodVariant'
import { ReviewStatusIndicator } from './ReviewStatusIndicator'
import { SelectCheckbox } from '../SelectCheckbox'
import { HeaderCheckState } from '../selection'
import { renewsLabel } from '../recordFormat'
import { isImported, isSelectable, ReviewRow, rowAmount } from './reviewRows'

interface ColumnContext {
  isSelected: (id: string) => boolean
  headerState: HeaderCheckState
  canSelectAll: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  paymentMethodVariant: PaymentMethodVariant
}

export function buildReviewColumns({
  isSelected,
  headerState,
  canSelectAll,
  onToggle,
  onToggleAll,
  paymentMethodVariant,
}: ColumnContext): DataTableColumnDef<ReviewRow>[] {
  const paymentColumn = paymentMethodVariant === 'column'
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
      size: 280,
      header: 'Customer',
      cell: ({ row }) => (
        <NameCell row={row.original} showPaymentMethod={!paymentColumn} />
      ),
    },
    {
      id: 'product',
      size: 200,
      header: 'Product',
      cell: ({ row }) => <ProductCell row={row.original} />,
    },
    ...(paymentColumn
      ? [
          {
            id: 'payment_method',
            size: 140,
            header: 'Payment',
            cell: ({ row }) => <PaymentMethodLabel row={row.original} />,
          } satisfies DataTableColumnDef<ReviewRow>,
        ]
      : []),
    {
      id: 'status',
      size: 160,
      header: 'Import',
      cell: ({ row }) => <ReviewStatusIndicator row={row.original} />,
    },
    {
      id: 'renews',
      size: 140,
      header: 'Renews',
      cell: ({ row }) => <RenewsCell row={row.original} />,
    },
    {
      id: 'amount',
      size: 140,
      header: () => (
        <Box width="100%" justifyContent="end">
          <Text variant="caption" color="muted">
            Amount
          </Text>
        </Box>
      ),
      cell: ({ row }) => <AmountCell row={row.original} />,
    },
  ]
  return columns
}

function NameCell({
  row,
  showPaymentMethod,
}: {
  row: ReviewRow
  showPaymentMethod: boolean
}) {
  return (
    <Box minWidth={0} alignItems="center" columnGap="s">
      <Text truncate color={row.status === 'skipped' ? 'muted' : 'default'}>
        {row.customer_email || row.title}
      </Text>
      {showPaymentMethod ? (
        <PaymentMethodLabel row={row} exceptionsOnly />
      ) : null}
    </Box>
  )
}

function ProductCell({ row }: { row: ReviewRow }) {
  if (!row.product_name) {
    return <Text color="muted">—</Text>
  }
  return (
    <Box minWidth={0}>
      <Text truncate color={row.status === 'skipped' ? 'muted' : 'default'}>
        {row.product_name}
      </Text>
    </Box>
  )
}

function RenewsCell({ row }: { row: ReviewRow }) {
  const label = renewsLabel(row)
  if (!label) {
    return <Text color="muted">—</Text>
  }
  return <Text color="muted">{label}</Text>
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
