'use client'

import { useCustomerOrderInvoice } from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import { Client, schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useCallback } from 'react'
import CustomerPortalOrder from './CustomerPortalOrder'
import { CustomerPortalOverview } from './CustomerPortalOverview'
import CustomerPortalSubscription from './CustomerPortalSubscription'

export interface CustomerPortalProps {
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['CustomerSubscription'][]
  orders: schemas['CustomerOrder'][]
  customerSessionToken?: string
}

export const CustomerPortal = ({
  organization,
  products,
  subscriptions,
  orders,
  customerSessionToken,
}: CustomerPortalProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const orderInvoiceMutation = useCustomerOrderInvoice(api)

  const openInvoice = useCallback(
    async (order: schemas['CustomerOrder']) => {
      const { url } = await orderInvoiceMutation.mutateAsync({ id: order.id })
      window.open(url, '_blank')
    },
    [orderInvoiceMutation],
  )

  return (
    <div className="flex flex-col gap-y-16 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <Avatar
          className="h-12 w-12"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        <h3 className="text-lg">{organization.name}</h3>
      </div>
      <div>
        <h2 className="text-4xl">Customer Portal</h2>
      </div>

      <CustomerPortalOverview
        api={api}
        organization={organization}
        products={products}
        subscriptions={subscriptions}
      />

      {orders.length > 0 && (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-lg">Orders</h3>
          </div>
          <DataTable
            data={orders ?? []}
            isLoading={false}
            columns={[
              {
                accessorKey: 'created_at',
                header: 'Date',
                cell: ({ row }) => (
                  <FormattedDateTime
                    datetime={row.original.created_at}
                    dateStyle="medium"
                    resolution="day"
                  />
                ),
              },
              {
                accessorKey: 'product.name',
                header: 'Product',
                cell: ({ row }) => row.original.product.name,
              },
              {
                accessorKey: 'amount',
                header: 'Amount',
                cell: ({ row }) => (
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    {formatCurrencyAndAmount(
                      row.original.amount,
                      row.original.currency,
                      0,
                    )}
                  </span>
                ),
              },
              {
                accessorKey: 'id',
                header: '',
                cell: ({ row }) => (
                  <span className="flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => openInvoice(row.original)}
                      loading={orderInvoiceMutation.isPending}
                      disabled={orderInvoiceMutation.isPending}
                    >
                      <span className="">View Invoice</span>
                    </Button>
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}

const SelectedItemDetails = ({
  item,
  products,
  api,
}: {
  item: schemas['CustomerSubscription'] | schemas['CustomerOrder']
  products: schemas['CustomerProduct'][]
  api: Client
}) => {
  // Render order details
  return 'recurring_interval' in item ? (
    <CustomerPortalSubscription
      api={api}
      subscription={item}
      products={products}
    />
  ) : (
    <CustomerPortalOrder api={api} order={item} />
  )
}
