import { OrderStatus } from '@/components/Orders/OrderStatus'
import {
  type CondensedTableColumn,
  type CondensedTableColumnMeta,
} from '@/components/Shared/CondensedTable'
import { StatusLabel } from '@/components/Shared/StatusIcon'
import { type SubscriptionActivityItem } from '@/utils/subscriptionSummary'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { BillingHistoryDate } from './BillingHistoryDate'
import { type UpcomingCharge } from './SubscriptionInvoicePreview'

// One line of the billing history: the charge still to come, an order, or
// something that happened to the subscription between them.
export type BillingHistoryRow = { id: string; at: number } & (
  | { kind: 'upcoming'; charge: UpcomingCharge; currency: string }
  | { kind: 'order'; order: schemas['Order'] }
  | { kind: 'event'; event: SubscriptionActivityItem }
)

const BILLING_REASON_LABELS: Record<schemas['OrderBillingReason'], string> = {
  purchase: 'Purchase',
  subscription_create: 'New subscription',
  subscription_cycle: 'Renewal',
  subscription_update: 'Plan change',
  subscription_meter_cycle: 'Usage',
}

// Shared with the lines under an open order, which sit on the same columns.
export const DATE_COLUMN: CondensedTableColumnMeta = { width: 170 }
export const TYPE_COLUMN: CondensedTableColumnMeta = { grow: 1, minWidth: 96 }
export const STATUS_COLUMN: CondensedTableColumnMeta = { width: 170 }
export const AMOUNT_COLUMN: CondensedTableColumnMeta = {
  width: 100,
  align: 'end',
}

const isUpcoming = (row: BillingHistoryRow) =>
  row.kind === 'upcoming' || (row.kind === 'event' && row.event.upcoming)

export const getBillingHistoryType = (row: BillingHistoryRow): string => {
  if (row.kind === 'upcoming') return row.charge.title
  if (row.kind === 'event') return row.event.label
  return BILLING_REASON_LABELS[row.order.billing_reason]
}

export const BillingHistoryStatus = ({ row }: { row: BillingHistoryRow }) => {
  if (row.kind === 'order') return <OrderStatus status={row.order.status} />
  return isUpcoming(row) ? (
    <StatusLabel shape="dashed" label="Scheduled" />
  ) : null
}

export const getBillingHistoryAmount = (
  row: BillingHistoryRow,
): string | null => {
  const format = formatCurrency('accounting')
  if (row.kind === 'upcoming') {
    return format(row.charge.preview.total_amount, row.currency)
  }
  if (row.kind === 'order') {
    return format(row.order.total_amount, row.order.currency)
  }
  return null
}

export const BILLING_HISTORY_COLUMNS: CondensedTableColumn<BillingHistoryRow>[] =
  [
    {
      id: 'date',
      header: 'Date',
      meta: DATE_COLUMN,
      cell: ({ row: { original } }) => (
        <BillingHistoryDate at={original.at} muted={isUpcoming(original)} />
      ),
    },
    {
      id: 'type',
      header: 'Type',
      meta: TYPE_COLUMN,
      cell: ({ row: { original } }) => (
        <Text color="muted" truncate>
          {getBillingHistoryType(original)}
        </Text>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      meta: STATUS_COLUMN,
      cell: ({ row: { original } }) => <BillingHistoryStatus row={original} />,
    },
    {
      id: 'amount',
      header: 'Amount',
      meta: AMOUNT_COLUMN,
      cell: ({ row: { original } }) => (
        <Text
          color={isUpcoming(original) ? 'muted' : 'default'}
          tabularNums
          align="right"
        >
          {getBillingHistoryAmount(original)}
        </Text>
      ),
    },
  ]
