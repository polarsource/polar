import { OrderAmountWithRefund } from '@/components/Refunds/OrderAmountWithRefund'
import { useDiscounts, useMetrics } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import { getDiscountDisplay } from '@/utils/discount'
import { dateToInterval } from '@/utils/metrics'
import { OrderCustomer, Organization, Product } from '@polar-sh/api'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { DashboardBody } from '../../Layout/DashboardLayout'
import MetricChartBox from '../../Metrics/MetricChartBox'
import { ProductPageContextView } from './ProductPageContextView'

export interface ProductPageProps {
  organization: Organization
  product: Product
}

export const ProductPage = ({ organization, product }: ProductPageProps) => {
  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    organizationId: organization.id,
    productId: [product.id],
    interval: dateToInterval(new Date(product.created_at)),
    startDate: new Date(product.created_at),
    endDate: new Date(),
  })

  const { data: productOrders, isLoading: productOrdersIsLoading } = useOrders(
    organization.id,
    {
      productId: product.id,
      limit: 10,
    },
  )

  const { data: discountsData, isLoading: discountsLoading } = useDiscounts(
    organization.id,
  )

  const productDiscounts = discountsData?.items.filter((discount) =>
    discount.products.some((p) => p.id === product.id),
  )

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl">{product.name}</h1>
          <span className="dark:text-polar-500 text-base text-gray-500">
            {product.is_recurring ? 'Subscription' : 'One-time Product'}
          </span>
        </div>
      }
      contextViewClassName="hidden md:block"
      contextView={
        <ProductPageContextView organization={organization} product={product} />
      }
    >
      <div className="flex flex-col gap-y-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8">
          <MetricChartBox
            data={metricsData?.periods ?? []}
            loading={metricsLoading}
            metric={metricsData?.metrics.orders}
            height={150}
            compact
          />
          <MetricChartBox
            data={metricsData?.periods ?? []}
            loading={metricsLoading}
            metric={metricsData?.metrics.revenue}
            height={150}
            compact
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
                  const customer = props.getValue() as OrderCustomer
                  return (
                    <div className="flex flex-row items-center gap-2">
                      <Avatar
                        className="h-8 w-8"
                        avatar_url={customer.avatar_url}
                        name={customer.name || customer.email}
                      />
                      <div className="fw-medium">{customer.email}</div>
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
                header: ({ column }) => null,
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
              <h2 className="text-lg">Active Discounts</h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                All Discounts associated with {product.name}
              </p>
            </div>
          </div>
          <DataTable
            data={productDiscounts ?? []}
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
                accessorKey: 'amount',
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Amount" />
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
              {
                accessorKey: 'actions',
                enableSorting: true,
                header: ({ column }) => null,
                cell: (props) => (
                  <span className="flex flex-row justify-end">
                    <Link
                      href={`/dashboard/${organization.slug}/discounts/${props.row.original.id}`}
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
      </div>
    </DashboardBody>
  )
}
