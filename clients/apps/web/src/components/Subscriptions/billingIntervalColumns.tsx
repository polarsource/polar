import FormattedUnits from '@/components/Meter/FormattedUnits'
import { renderMeteredPrice } from '@/components/Products/ProductPriceLabel'
import {
  type CondensedTableColumn,
  type CondensedTableColumnMeta,
} from '@/components/Shared/CondensedTable'
import {
  StatusLabel,
  type StatusIconShape,
} from '@/components/Shared/StatusIcon'
import { isMeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { format } from 'date-fns'
import Link from 'next/link'

type Group = schemas['SubscriptionBillingIntervalUsageGroup']
type Generation = schemas['SubscriptionBillingIntervalGeneration']
type Status = schemas['BillingIntervalGenerationStatus'] | 'partial'

export type BillingIntervalRow = {
  id: string
  interval: schemas['SubscriptionBillingInterval']
  group: Group | null
}

export const getBillingIntervalRows = (
  usages: schemas['SubscriptionBillingIntervalUsage'][],
): BillingIntervalRow[] =>
  usages.flatMap(({ interval, groups }): BillingIntervalRow[] =>
    groups.length > 0
      ? groups.map((group, index) => ({
          id: `${interval.id}-${index}`,
          interval,
          group,
        }))
      : [{ id: interval.id, interval, group: null }],
  )

export const PERIOD_COLUMN: CondensedTableColumnMeta = { width: 250 }
export const PRICE_COLUMN: CondensedTableColumnMeta = { grow: 1, minWidth: 160 }
export const USAGE_COLUMN: CondensedTableColumnMeta = {
  width: 100,
  align: 'end',
}
export const AMOUNT_COLUMN: CondensedTableColumnMeta = {
  width: 100,
  align: 'end',
}
export const STATUS_COLUMN: CondensedTableColumnMeta = { width: 120 }
export const GEN_COLUMN: CondensedTableColumnMeta = { width: 48, align: 'end' }

const formatDate = (date: string) => format(new Date(date), 'MMM d, yyyy HH:mm')

const formatPeriod = (start: string, end: string | null) => {
  if (end === null) return `${formatDate(start)} – Ongoing`
  const sameDay =
    format(new Date(start), 'yyyy-MM-dd') ===
    format(new Date(end), 'yyyy-MM-dd')
  return `${formatDate(start)} – ${sameDay ? format(new Date(end), 'HH:mm') : formatDate(end)}`
}

export const formatAmount = (amount: number, currency: string) =>
  formatCurrency('accounting')(amount, currency)

const STATUSES: Record<Status, { shape: StatusIconShape; label: string }> = {
  open: { shape: 'dashed', label: 'Open' },
  unbilled: { shape: 'half', label: 'Unbilled' },
  billed: { shape: 'check', label: 'Billed' },
  not_charged: { shape: 'minus', label: 'Not charged' },
  partial: { shape: 'most', label: 'Partly billed' },
}

export const UsageStatus = ({
  organization,
  status,
  orderId,
}: {
  organization: schemas['Organization']
  status: Status
  orderId: string | null
}) => (
  <Box flexDirection="column" minWidth={0}>
    <StatusLabel {...STATUSES[status]} />
    {orderId && (
      <Link href={`/dashboard/${organization.slug}/sales/${orderId}`}>
        <Text color="muted">View order</Text>
      </Link>
    )}
  </Box>
)

export const UsageUnits = ({
  units,
  credits = 0,
}: {
  units: number
  credits?: number
}) => (
  <Box flexDirection="column" alignItems="end">
    <Text tabularNums>
      <FormattedUnits value={units} />
    </Text>
    {credits > 0 && (
      <Text color="muted" tabularNums>
        −<FormattedUnits value={credits} /> credits
      </Text>
    )}
  </Box>
)

const getGroupStatus = (
  generations: Generation[],
): { status: Status; orderId: string | null } => {
  const statuses = new Set(generations.map(({ status }) => status))
  const orderIds = new Set(generations.map(({ order_id }) => order_id))
  if (statuses.size === 1) {
    const [status] = statuses
    const [orderId] = orderIds
    return { status, orderId: orderIds.size === 1 ? orderId : null }
  }
  if (statuses.has('billed')) return { status: 'partial', orderId: null }
  return { status: statuses.has('open') ? 'open' : 'unbilled', orderId: null }
}

const POLICY_LABELS: Record<schemas['UsagePolicy'], string | null> = {
  charge: null,
  trial: 'Trial',
  paused: 'Paused',
}

export const getBillingIntervalColumns = (
  organization: schemas['Organization'],
): CondensedTableColumn<BillingIntervalRow>[] => [
  {
    id: 'period',
    header: 'Period',
    meta: PERIOD_COLUMN,
    cell: ({ row: { original } }) => {
      const { period_start, period_end } = original.group ?? original.interval
      return <Text tabularNums>{formatPeriod(period_start, period_end)}</Text>
    },
  },
  {
    id: 'price',
    header: 'Price',
    meta: PRICE_COLUMN,
    cell: ({ row: { original } }) => {
      const { product, product_price, usage_policy } = original.interval
      return (
        <Box flexDirection="column" minWidth={0}>
          <Link href={`/dashboard/${organization.slug}/products/${product.id}`}>
            <Text truncate>{product.name}</Text>
          </Link>
          {isMeteredPrice(product_price) && (
            <Text color="muted">{renderMeteredPrice(product_price)}</Text>
          )}
          {POLICY_LABELS[usage_policy] && (
            <Text color="muted">{POLICY_LABELS[usage_policy]}</Text>
          )}
        </Box>
      )
    },
  },
  {
    id: 'units',
    header: 'Usage',
    meta: USAGE_COLUMN,
    cell: ({ row: { original } }) =>
      original.group ? (
        <UsageUnits
          units={original.group.units}
          credits={original.group.credited_units}
        />
      ) : (
        <Text color="muted">No usage</Text>
      ),
  },
  {
    id: 'amount',
    header: 'Amount',
    meta: AMOUNT_COLUMN,
    cell: ({ row: { original } }) =>
      original.group ? (
        <Text tabularNums>
          {formatAmount(
            original.group.amount,
            original.interval.product_price.price_currency,
          )}
        </Text>
      ) : null,
  },
  {
    id: 'status',
    header: 'Status',
    meta: STATUS_COLUMN,
    cell: ({ row: { original } }) =>
      original.group ? (
        <UsageStatus
          organization={organization}
          {...getGroupStatus(original.group.generations)}
        />
      ) : null,
  },
  {
    id: 'generation',
    header: 'Gen',
    meta: GEN_COLUMN,
    cell: ({ row: { original } }) => {
      const generations = original.group?.generations ?? []
      if (generations.length === 0) return <Text tabularNums>—</Text>
      const first = generations[0].generation
      const last = generations[generations.length - 1].generation
      return (
        <Text tabularNums>{first === last ? first : `${first}–${last}`}</Text>
      )
    },
  },
]
