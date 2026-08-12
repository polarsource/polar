'use client'

import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import { useSubscriptions } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, DataTable, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

interface CustomerSubscriptionsTableProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerSubscriptionsTable = ({
  organization,
  customer,
}: CustomerSubscriptionsTableProps) => {
  const { data: subscriptions, isLoading } = useSubscriptions(
    customer.organization_id,
    {
      customer_id: customer.id,
      limit: 999,
      sorting: ['-started_at'],
    },
  )

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Subscriptions
      </Text>
      <DataTable
        data={subscriptions?.items ?? []}
        columns={[
          {
            header: 'Product Name',
            accessorKey: 'product.name',
            cell: ({ row: { original } }) => (
              <span>{original.product.name}</span>
            ),
          },
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row: { original } }) => (
              <SubscriptionStatusLabel
                className="text-xs"
                subscription={original}
              />
            ),
          },
          {
            header: 'Amount',
            accessorKey: 'amount',
            cell: ({ row: { original } }) =>
              original.amount && original.currency ? (
                <AmountLabel
                  amount={original.amount}
                  currency={original.currency}
                  interval={original.recurring_interval}
                  intervalCount={original.recurring_interval_count}
                />
              ) : (
                <span>—</span>
              ),
          },
          {
            header: '',
            accessorKey: 'action',
            cell: ({ row: { original } }) => (
              <Box justifyContent="end">
                <Link
                  href={`/dashboard/${organization.slug}/sales/subscriptions/${original.id}`}
                >
                  <Button variant="secondary" size="sm">
                    View
                  </Button>
                </Link>
              </Box>
            ),
          },
        ]}
        isLoading={isLoading}
        className="text-sm"
      />
    </Box>
  )
}
