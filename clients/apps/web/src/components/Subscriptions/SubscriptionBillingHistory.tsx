'use client'

import {
  CondensedTable,
  CondensedTableHeader,
  useCondensedTable,
} from '@/components/Shared/CondensedTable'
import { useOrders } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { BillingHistoryDate } from './BillingHistoryDate'
import { BillingHistoryOrderDetails } from './BillingHistoryOrderDetails'
import {
  BILLING_HISTORY_COLUMNS,
  BillingHistoryStatus,
  getBillingHistoryAmount,
  getBillingHistoryType,
  type BillingHistoryRow,
} from './billingHistoryColumns'
import { getBillingHistoryEvents } from './billingHistoryEvents'
import SubscriptionInvoicePreview, {
  useSubscriptionUpcomingCharge,
} from './SubscriptionInvoicePreview'

// An order still being retried is the one a merchant came to look at.
const isOpenByDefault = (row: BillingHistoryRow) =>
  row.kind === 'order' &&
  row.order.status === 'pending' &&
  row.order.next_payment_attempt_at != null

const getRowId = (row: BillingHistoryRow) => row.id

const CompactRow = ({ row }: { row: BillingHistoryRow }) => (
  <>
    <Box alignItems="center" justifyContent="between" gap="l">
      <BillingHistoryDate at={row.at} />
      <Text tabularNums>{getBillingHistoryAmount(row)}</Text>
    </Box>
    <Box alignItems="center" justifyContent="between" gap="l">
      <Text color="muted" truncate>
        {getBillingHistoryType(row)}
      </Text>
      <BillingHistoryStatus row={row} />
    </Box>
  </>
)

// The subscription from its next charge back to its first day: every order,
// each opening to what happened on it, and the events between them.
export const SubscriptionBillingHistory = ({
  organization,
  subscription,
}: {
  organization: schemas['Organization']
  subscription: schemas['Subscription']
}) => {
  const { data, isLoading } = useOrders(organization.id, {
    subscription_id: [subscription.id],
    sorting: ['-created_at'],
    limit: 100,
  })
  const charge = useSubscriptionUpcomingCharge(subscription)
  const [now] = useState(() => Date.now())
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const orders = data?.items ?? []

  const past: BillingHistoryRow[] = [
    ...orders.map((order) => ({
      kind: 'order' as const,
      id: order.id,
      at: new Date(order.created_at).getTime(),
      order,
    })),
    ...getBillingHistoryEvents(
      subscription,
      orders,
      charge?.chargeDate,
      now,
    ).map((event) => ({
      kind: 'event' as const,
      id: `${event.label}-${event.at}`,
      at: event.at,
      event,
    })),
  ].sort((a, b) => b.at - a.at)
  const rows: BillingHistoryRow[] = charge?.chargeDate
    ? [
        {
          kind: 'upcoming',
          id: 'upcoming',
          at: new Date(charge.chargeDate).getTime(),
          charge,
          currency: subscription.currency,
        },
        ...past,
      ]
    : past

  const table = useCondensedTable({
    columns: BILLING_HISTORY_COLUMNS,
    rows,
    getRowId,
  })
  const isExpanded = (row: BillingHistoryRow) =>
    toggled[row.id] ?? isOpenByDefault(row)

  if (isLoading) {
    return <Text color="muted">Loading billing history</Text>
  }
  return (
    <Box as="section" aria-label="Billing history" flexDirection="column">
      {/* The rows are inset, so their text lines up with the page's. */}
      <Box flexDirection="column" marginHorizontal="-m">
        <CondensedTableHeader table={table} compact expandable />
        <CondensedTable
          table={table}
          renderCompact={(row) => <CompactRow row={row} />}
          expansion={{
            canExpand: (row) => row.kind !== 'event',
            isExpanded,
            onToggle: (row) =>
              setToggled((current) => ({
                ...current,
                [row.id]: !isExpanded(row),
              })),
            render: (row) =>
              row.kind === 'upcoming' ? (
                <SubscriptionInvoicePreview
                  subscription={subscription}
                  charge={row.charge}
                />
              ) : row.kind === 'order' ? (
                <BillingHistoryOrderDetails
                  organization={organization}
                  order={row.order}
                />
              ) : null,
          }}
        />
      </Box>
    </Box>
  )
}
