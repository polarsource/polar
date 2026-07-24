import { OrderStatus } from '@/components/Orders/OrderStatus'
import { useOrders } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Avatar } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import { DataTable, DataTableColumnHeader } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

export interface ProductOrdersProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const ProductOrders = ({
  organization,
  product,
}: ProductOrdersProps) => {
  const { data: productOrders, isLoading: productOrdersIsLoading } = useOrders(
    organization.id,
    {
      product_id: product.id,
      limit: 10,
    },
  )

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-row items-center justify-between gap-x-6">
        <div className="flex flex-col gap-y-1">
          <h2 className="text-lg">Orders</h2>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Showing last 10 orders for {product.name}
          </p>
        </div>
        <Link
          href={`/dashboard/${organization.slug}/sales?product_id=${product.id}`}
        >
          <Button size="sm">View All</Button>
        </Link>
      </div>
      <DataTable
        data={productOrders?.items ?? []}
        columns={[
          {
            accessorKey: 'customer',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Customer" />
            ),
            cell: (props) => {
              const customer = props.getValue() as schemas['OrderCustomer']
              return (
                <div className="flex flex-row items-center gap-2">
                  <Avatar
                    className="h-8 w-8"
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
            cell: ({ row: { original: order } }) => (
              <span className="flex shrink">
                <OrderStatus status={order.status} />
              </span>
            ),
          },
          {
            accessorKey: 'amount',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Amount" />
            ),
            cell: ({ row: { original: order } }) => (
              <span>
                {formatCurrency('compact')(order.net_amount, order.currency)}
              </span>
            ),
          },
          {
            accessorKey: 'created_at',
            enableSorting: true,
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Date" />
            ),
            cell: (props) => (
              <FormattedDateTime datetime={props.getValue() as string} />
            ),
          },
          {
            accessorKey: 'actions',
            enableSorting: true,
            header: () => null,
            cell: (props) => (
              <span className="flex flex-row justify-end">
                <Link
                  href={`/dashboard/${organization.slug}/sales/${props.row.original.id}`}
                >
                  <Button variant="secondary" size="sm">
                    View
                  </Button>
                </Link>
              </span>
            ),
          },
        ]}
        isLoading={productOrdersIsLoading}
      />
    </div>
  )
}
