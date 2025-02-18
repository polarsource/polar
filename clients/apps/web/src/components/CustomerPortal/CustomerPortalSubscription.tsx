'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useCustomerBenefitGrants,
  useCustomerOrderInvoice,
  useCustomerOrders,
} from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useCallback } from 'react'

const CustomerPortalSubscription = ({
  api,
  subscription,
  products,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
}) => {
  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    subscription_id: subscription.id,
    limit: 100,
    sorting: ['type'],
  })

  const { data: orders } = useCustomerOrders(api, {
    subscription_id: subscription.id,
    limit: 100,
    sorting: ['-created_at'],
  })

  const orderInvoiceMutation = useCustomerOrderInvoice(api)
  const openInvoice = useCallback(
    async (order: schemas['CustomerOrder']) => {
      const { url } = await orderInvoiceMutation.mutateAsync({ id: order.id })
      window.open(url, '_blank')
    },
    [orderInvoiceMutation],
  )

  const hasInvoices = orders?.items && orders.items.length > 0

  return (
    <>
      <div className="flex h-full flex-col gap-8">
        <div className="flex w-full flex-col gap-8">
          {(benefitGrants?.items.length ?? 0) > 0 && (
            <div className="flex flex-col gap-4">
              <List>
                {benefitGrants?.items.map((benefitGrant) => (
                  <ListItem
                    key={benefitGrant.id}
                    className="py-6 hover:bg-transparent dark:hover:bg-transparent"
                  >
                    <BenefitGrant api={api} benefitGrant={benefitGrant} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-8">
          {hasInvoices && (
            <div className="flex flex-col gap-y-6">
              <h3 className="text-xl">Invoices</h3>
              <DataTable
                data={orders.items ?? []}
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
      </div>
    </>
  )
}

export default CustomerPortalSubscription
