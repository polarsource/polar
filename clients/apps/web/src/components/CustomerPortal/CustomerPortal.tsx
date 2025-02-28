'use client'

import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import CustomerPortalOrder from './CustomerPortalOrder'
import { CustomerPortalOverview } from './CustomerPortalOverview'

export interface CustomerPortalProps {
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['CustomerSubscription'][]
  oneTimePurchases: schemas['CustomerOrder'][]
  customerSessionToken?: string
}

export const CustomerPortal = ({
  organization,
  products,
  subscriptions,
  oneTimePurchases,
  customerSessionToken,
}: CustomerPortalProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const [selectedOrder, setSelectedOrder] = useState<
    schemas['CustomerOrder'] | null
  >(null)
  const {
    isShown: isOrderModalOpen,
    hide: hideOrderModal,
    show: showOrderModal,
  } = useModal()

  return (
    <div className="flex flex-col gap-y-16">
      <CustomerPortalOverview
        api={api}
        organization={organization}
        products={products}
        subscriptions={subscriptions}
        customerSessionToken={customerSessionToken}
      />
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between">
          <h3 className="text-2xl">Product Purchases</h3>
        </div>
        <DataTable
          data={oneTimePurchases ?? []}
          isLoading={false}
          columns={[
            {
              accessorKey: 'product.name',
              header: 'Product',
              cell: ({ row }) => row.original.product.name,
            },
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
              accessorKey: 'id',
              header: '',
              cell: ({ row }) => (
                <span className="flex justify-end">
                  <Button
                    className="hidden md:flex"
                    variant="secondary"
                    onClick={() => {
                      setSelectedOrder(row.original)
                      showOrderModal()
                    }}
                  >
                    View Purchase
                  </Button>
                  <Link
                    className="md:hidden"
                    href={`/${organization.slug}/portal/orders/${row.original.id}?customer_session_token=${customerSessionToken}`}
                  >
                    <Button variant="secondary">View Purchase</Button>
                  </Link>
                </span>
              ),
            },
          ]}
        />
        <InlineModal
          isShown={isOrderModalOpen}
          hide={hideOrderModal}
          modalContent={
            selectedOrder ? (
              <div className="flex flex-col overflow-y-auto p-8">
                <CustomerPortalOrder api={api} order={selectedOrder} />
              </div>
            ) : (
              <></>
            )
          }
        />
      </div>
    </div>
  )
}
