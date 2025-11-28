import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import { OrderStatus } from '../Orders/OrderStatus'
import CustomerPortalOrder from './CustomerPortalOrder'

export interface CustomerPortalOrdersProps {
  organization: schemas['CustomerOrganization']
  orders: schemas['CustomerOrder'][]
  customerSessionToken: string
}

export const CustomerPortalOrders = ({
  organization,
  orders,
  customerSessionToken,
}: CustomerPortalOrdersProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const [selectedOrder, setSelectedOrder] = useState<
    schemas['CustomerOrder'] | null
  >(null)

  const theme = useTheme()
  const themingPreset = getThemePreset(
    organization.slug,
    theme.resolvedTheme as 'light' | 'dark',
  )

  const {
    isShown: isOrderModalOpen,
    hide: hideOrderModal,
    show: showOrderModal,
  } = useModal()

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-xl">Order History</h3>
      </div>
      <DataTable
        data={orders ?? []}
        isLoading={false}
        columns={[
          {
            accessorKey: 'description',
            header: 'Description',
          },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
              <span className="flex shrink">
                <OrderStatus status={row.original.status} />
              </span>
            ),
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
            cell: ({ row }) => {
              const order = row.original

              return (
                <span className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedOrder(order)
                      showOrderModal()
                    }}
                    className="hidden md:flex"
                    size="sm"
                  >
                    View Order
                  </Button>
                  <Link
                    className="md:hidden"
                    href={`/${organization.slug}/portal/orders/${order.id}?customer_session_token=${customerSessionToken}`}
                  >
                    <Button variant="secondary" size="sm">
                      View Order
                    </Button>
                  </Link>
                </span>
              )
            },
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
                customerSessionToken={customerSessionToken}
                themingPreset={themingPreset}
              />
            </div>
          ) : (
            <></>
          )
        }
      />
    </div>
  )
}
