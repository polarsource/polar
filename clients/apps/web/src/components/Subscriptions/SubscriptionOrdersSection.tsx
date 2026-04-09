'use client'

import { useOrders } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

interface SubscriptionOrdersSectionProps {
  organization: schemas['Organization']
  subscription: schemas['Subscription']
}

const SubscriptionOrdersSection = ({
  organization,
  subscription,
}: SubscriptionOrdersSectionProps) => {
  const { data: orders, isLoading } = useOrders(organization.id, {
    subscription_id: [subscription.id],
    sorting: ['-created_at'],
    limit: 100,
  })

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg">Orders</h3>
      <DataTable
        data={orders?.items ?? []}
        columns={[
          {
            header: 'Description',
            accessorKey: 'description',
            cell: ({ row: { original } }) => (
              <Link
                href={`/dashboard/${organization.slug}/sales/${original.id}`}
              >
                <span>{original.description}</span>
              </Link>
            ),
          },
          {
            header: 'Date',
            accessorKey: 'created_at',
            cell: ({ row: { original } }) => (
              <span className="dark:text-polar-500 text-sm text-gray-500">
                <FormattedDateTime datetime={original.created_at} />
              </span>
            ),
          },
          {
            header: 'Amount',
            accessorKey: 'net_amount',
            cell: ({ row: { original } }) =>
              formatCurrency('compact')(original.net_amount, original.currency),
          },
          {
            header: '',
            accessorKey: 'action',
            cell: ({ row: { original } }) => (
              <div className="flex justify-end">
                <Link
                  href={`/dashboard/${organization.slug}/sales/${original.id}`}
                >
                  <Button variant="secondary" size="sm">
                    View
                  </Button>
                </Link>
              </div>
            ),
          },
        ]}
        isLoading={isLoading}
        className="text-sm"
      />
    </div>
  )
}

export default SubscriptionOrdersSection
