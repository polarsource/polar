'use client'

import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import Link from 'next/link'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
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

  const themingPreset = useThemePreset(
    organization.slug === 'midday' ? 'midday' : 'polar',
  )

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
          wrapperClassName={themingPreset.polar.table}
          headerClassName={themingPreset.polar.tableHeader}
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
                    variant="secondary"
                    onClick={() => {
                      setSelectedOrder(row.original)
                      showOrderModal()
                    }}
                    className={twMerge(
                      'hidden md:flex',
                      themingPreset.polar.buttonSecondary,
                    )}
                  >
                    View Purchase
                  </Button>
                  <Link
                    className="md:hidden"
                    href={`/${organization.slug}/portal/orders/${row.original.id}?customer_session_token=${customerSessionToken}`}
                  >
                    <Button
                      variant="secondary"
                      className={twMerge(
                        'hidden md:flex',
                        themingPreset.polar.buttonSecondary,
                      )}
                    >
                      View Purchase
                    </Button>
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
                <CustomerPortalOrder
                  api={api}
                  order={selectedOrder}
                  themingPreset={themingPreset}
                />
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
