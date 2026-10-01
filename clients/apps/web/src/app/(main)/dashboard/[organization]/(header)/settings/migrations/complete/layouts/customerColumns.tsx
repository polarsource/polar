import { formatCurrency } from '@polar-sh/currency'
import { DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from 'lucide-react'
import { MappingRow } from '../idMapping'
import { CopyableId, MappingStatus, PolarIdCell } from '../mappingColumns'
import { intervalAbbreviation } from '../../switch/switchRows'
import { CustomerRow } from '../viewModels'

const formatAmount = formatCurrency('accounting', 'en-US')

function IdPair({
  row,
  stripeId,
  organizationSlug,
}: {
  row: MappingRow | null
  stripeId: string
  organizationSlug: string
}) {
  return (
    <Box alignItems="center" columnGap="s" minWidth={0} flexWrap="wrap">
      <CopyableId value={stripeId} />
      <Box color="text-tertiary">
        <ArrowRight size={12} />
      </Box>
      {row ? (
        <PolarIdCell row={row} organizationSlug={organizationSlug} />
      ) : (
        <Text variant="caption" color="muted">
          From an earlier migration
        </Text>
      )}
    </Box>
  )
}

const plan = (row: MappingRow) => {
  const { amount, currency, recurring_interval } = row.record
  if (amount == null || !currency) return row.record.product_name ?? null
  const interval = intervalAbbreviation(recurring_interval ?? null)
  return `${row.record.product_name ?? ''} ${formatAmount(amount, currency)}${interval ? interval : ''}`.trim()
}

export function buildCustomerColumns(
  organizationSlug: string,
): DataTableColumnDef<CustomerRow>[] {
  return [
    {
      id: 'customer',
      size: 220,
      header: 'Customer',
      cell: ({ row }) => (
        <Box flexDirection="column" minWidth={0}>
          <Text variant="caption" truncate>
            {row.original.label}
          </Text>
          {row.original.customer?.detail && (
            <Text variant="caption" color="muted">
              {row.original.customer.detail}
            </Text>
          )}
        </Box>
      ),
    },
    {
      id: 'customer-ids',
      size: 300,
      header: 'Customer  Stripe → Polar',
      cell: ({ row }) => (
        <IdPair
          row={row.original.customer}
          stripeId={row.original.stripeId}
          organizationSlug={organizationSlug}
        />
      ),
    },
    {
      id: 'subscription-ids',
      size: 340,
      header: 'Subscription  Stripe → Polar',
      cell: ({ row }) => (
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          {row.original.subscriptions.map((subscription) => (
            <IdPair
              key={subscription.stripeId}
              row={subscription}
              stripeId={subscription.stripeId}
              organizationSlug={organizationSlug}
            />
          ))}
        </Box>
      ),
    },
    {
      id: 'plan',
      size: 150,
      header: 'Plan',
      cell: ({ row }) => (
        <Box flexDirection="column" rowGap="xs">
          {row.original.subscriptions.map((subscription) => (
            <Text key={subscription.stripeId} variant="caption" color="muted">
              {plan(subscription) ?? '—'}
            </Text>
          ))}
        </Box>
      ),
    },
    {
      id: 'status',
      size: 130,
      header: 'Billing',
      cell: ({ row }) => (
        <Box flexDirection="column" rowGap="xs" alignItems="start">
          {row.original.subscriptions.map((subscription) => (
            <MappingStatus key={subscription.stripeId} row={subscription} />
          ))}
        </Box>
      ),
    },
  ]
}
