'use client'

import { OrderStatus } from '@/components/Orders/OrderStatus'
import { useOrders } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, DataTable, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

interface CustomerOrdersTableProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
}

export const CustomerOrdersTable = ({
  organization,
  customer,
}: CustomerOrdersTableProps) => {
  const { data: orders, isLoading } = useOrders(customer.organization_id, {
    customer_id: customer.id,
    limit: 999,
    sorting: ['-created_at'],
  })

  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Orders
      </Text>
      <DataTable
        data={orders?.items ?? []}
        columns={[
          {
            header: 'Description',
            accessorKey: 'description',
            cell: ({ row: { original } }) => (
              <Link
                href={`/dashboard/${organization.slug}/sales/${original.id}`}
                key={original.id}
              >
                <span>{original.description}</span>
              </Link>
            ),
          },
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row: { original } }) => (
              <OrderStatus status={original.status} />
            ),
          },
          {
            header: 'Amount',
            accessorKey: 'amount',
            cell: ({ row: { original } }) =>
              formatCurrency('compact')(original.net_amount, original.currency),
          },
          {
            header: 'Date',
            accessorKey: 'created_at',
            cell: ({ row: { original } }) => (
              <FormattedDateTime datetime={original.created_at} />
            ),
          },
          {
            header: '',
            accessorKey: 'action',
            cell: ({ row: { original } }) => (
              <Box justifyContent="end">
                <Link
                  href={`/dashboard/${organization.slug}/sales/${original.id}`}
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
