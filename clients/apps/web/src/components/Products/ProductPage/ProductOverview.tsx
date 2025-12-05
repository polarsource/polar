import { MiniMetricChartBox } from '@/components/Metrics/MiniMetricChartBox'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import { SubscriptionStatus as SubscriptionStatusComponent } from '@/components/Subscriptions/SubscriptionStatus'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { useDiscounts } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { getDiscountDisplay } from '@/utils/discount'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
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

  const { data: subscriptions, isLoading: subscriptionsIsLoading } =
    useSubscriptions(
      product.is_recurring ? organization.id : undefined,
      product.is_recurring
        ? {
            product_id: product.id,
            active: true,
            limit: 10,
          }
        : undefined,
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
        {product.is_recurring ? (
          <>
            <MiniMetricChartBox
              title="Active Subscriptions"
              metric={metrics?.metrics.active_subscriptions}
              value={metrics?.totals.active_subscriptions}
            />
            <MiniMetricChartBox
              title="Monthly Recurring Revenue"
              metric={metrics?.metrics.monthly_recurring_revenue}
              value={metrics?.totals.monthly_recurring_revenue}
            />
          </>
        ) : (
          <>
            <MiniMetricChartBox
              metric={metrics?.metrics.one_time_products}
              value={metrics?.totals.one_time_products}
            />
            <MiniMetricChartBox
              title="Today's Revenue"
              metric={todayMetrics?.metrics.revenue}
              value={todayMetrics?.periods.at(-1)?.revenue}
            />
          </>
        )}
        <MiniMetricChartBox
          metric={metrics?.metrics.cumulative_revenue}
          value={metrics?.periods.at(-1)?.cumulative_revenue}
        />
      </div>
      {product.is_recurring && (
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
                        name={customer.name || customer.email}
                      />
                      <div className="fw-medium overflow-hidden text-ellipsis">
                        {customer.email}
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
                  return (
                    <SubscriptionStatusComponent subscription={subscription} />
                  )
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
      )}
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
                <span>
                  {formatCurrencyAndAmount(order.net_amount, order.currency)}
                </span>
              ),
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

      <RevenueWidget productId={product.id} />

      {!product.is_archived && (
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
      )}
    </div>
  )
}
