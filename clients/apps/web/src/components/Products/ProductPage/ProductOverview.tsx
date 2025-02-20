import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import { OrderAmountWithRefund } from '@/components/Refunds/OrderAmountWithRefund'
import { useDiscounts } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { getDiscountDisplay } from '@/utils/discount'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

export interface ProductOverviewProps {
  organization: schemas['Organization']
  product: schemas['Product']
  metrics?: schemas['MetricsResponse']
  todayMetrics?: schemas['MetricsResponse']
}

export const ProductOverview = ({
  organization,
  product,
  metrics,
  todayMetrics,
}: ProductOverviewProps) => {
  const { data: productOrders, isLoading: productOrdersIsLoading } = useOrders(
    organization.id,
    {
      product_id: product.id,
      limit: 10,
    },
  )

  const { data: discountsData, isLoading: discountsLoading } = useDiscounts(
    organization.id,
    {
      limit: 100,
    },
  )

  const applicableDiscounts = discountsData?.items.filter(
    (discount) =>
      discount.products.length === 0 ||
      discount.products.some((p) => p.id === product.id),
  )

  return (
    <div className="flex flex-col gap-y-16">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <MiniMetricChartBox
          metric={metrics?.metrics.orders}
          value={metrics?.periods.reduce(
            (acc, current) => acc + current.orders,
            0,
          )}
        />
        <MiniMetricChartBox
          title="Today's Revenue"
          metric={todayMetrics?.metrics.revenue}
          value={todayMetrics?.periods[todayMetrics.periods.length - 1].revenue}
        />
        <MiniMetricChartBox
          metric={metrics?.metrics.cumulative_revenue}
          value={
            metrics?.periods[metrics?.periods.length - 1].cumulative_revenue
          }
        />
      </div>
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-row items-center justify-between gap-x-6">
          <div className="flex flex-col gap-y-1">
            <h2 className="text-lg">Product Orders</h2>
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
                      name={customer.name || customer.email}
                    />
                    <div className="fw-medium truncate">{customer.email}</div>
                  </div>
                )
              },
            },
            {
              accessorKey: 'amount',
              enableSorting: true,
              header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Amount" />
              ),
              cell: ({ row: { original: order } }) => (
                <OrderAmountWithRefund order={order} />
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
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-row items-center justify-between gap-x-6">
          <div className="flex flex-col gap-y-1">
            <h2 className="text-lg">Applicable Discounts</h2>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              All Discounts valid for {product.name}
            </p>
          </div>
        </div>
        <DataTable
          data={applicableDiscounts ?? []}
          columns={[
            {
              accessorKey: 'name',
              enableSorting: true,
              header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Name" />
              ),
              cell: (props) => {
                return props.getValue() as string
              },
            },
            {
              accessorKey: 'code',
              enableSorting: true,
              header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Code" />
              ),
              cell: ({ row: { original: discount } }) => (
                <span>{discount.code}</span>
              ),
            },
            {
              accessorKey: 'amount',
              enableSorting: true,
              header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Amount" />
              ),
              cell: ({ row: { original: discount } }) => (
                <span>{getDiscountDisplay(discount)}</span>
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
          ]}
          isLoading={discountsLoading}
        />
      </div>
    </div>
  )
}
