import { SubscriptionStatus as SubscriptionStatusComponent } from '@/components/Subscriptions/SubscriptionStatus'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { schemas } from '@polar-sh/client'
import { Avatar } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import { DataTable, DataTableColumnHeader } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

export interface ProductSubscriptionsProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductSubscriptions = ({
  organization,
  product,
}: ProductSubscriptionsProps) => {
  const { data: subscriptions, isLoading: subscriptionsIsLoading } =
    useSubscriptions(organization.id, {
      product_id: product.id,
      active: true,
      limit: 10,
    })

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-row items-center justify-between gap-x-6">
        <div className="flex flex-col gap-y-1">
          <h2 className="text-lg">Subscriptions</h2>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Showing 10 most recent subscriptions for {product.name}
          </p>
        </div>
        <Link
          href={`/dashboard/${organization.slug}/sales/subscriptions?product_id=${product.id}`}
        >
          <Button size="sm">View All</Button>
        </Link>
      </div>
      <DataTable
        data={subscriptions?.items ?? []}
        columns={[
          {
            id: 'customer',
            accessorKey: 'customer',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Customer" />
            ),
            cell: ({ row: { original: subscription } }) => {
              const customer = subscription.customer
              return (
                <div className="flex flex-row items-center gap-2">
                  <Avatar
                    avatar_url={customer.avatar_url}
                    name={customer.name ?? customer.email ?? '—'}
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate">{customer.name ?? '—'}</span>
                    <span className="dark:text-polar-500 truncate text-xs text-gray-500">
                      {customer.email ?? '—'}
                    </span>
                  </div>
                </div>
              )
            },
          },
          {
            accessorKey: 'status',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Status" />
            ),
            cell: ({ row: { original: subscription } }) => {
              return <SubscriptionStatusComponent subscription={subscription} />
            },
          },
          {
            accessorKey: 'started_at',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title="Subscription Date"
              />
            ),
            cell: (props) => (
              <FormattedDateTime datetime={props.getValue() as string} />
            ),
          },
          {
            accessorKey: 'current_period_end',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Renewal Date" />
            ),
            cell: ({
              getValue,
              row: {
                original: { status, cancel_at_period_end },
              },
            }) => {
              const datetime = getValue() as string | null
              const willRenew =
                (status === 'active' || status === 'trialing') &&
                !cancel_at_period_end
              return datetime && willRenew ? (
                <FormattedDateTime datetime={datetime} />
              ) : (
                '—'
              )
            },
          },
          {
            accessorKey: 'actions',
            enableSorting: false,
            header: () => null,
            cell: (props) => (
              <span className="flex flex-row justify-end gap-x-2">
                <Link
                  href={`/dashboard/${organization.slug}/customers/${props.row.original.customer.id}`}
                >
                  <Button variant="secondary" size="sm">
                    View Customer
                  </Button>
                </Link>
                <Link
                  href={`/dashboard/${organization.slug}/sales/subscriptions/${props.row.original.id}`}
                >
                  <Button variant="secondary" size="sm">
                    View Subscription
                  </Button>
                </Link>
              </span>
            ),
          },
        ]}
        isLoading={subscriptionsIsLoading}
      />
    </div>
  )
}
