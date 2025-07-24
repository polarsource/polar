import { useRetryPayment } from '@/hooks/useRetryPayment'
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
import { OrderStatus } from '../Orders/OrderStatus'
import CustomerPortalOrder from './CustomerPortalOrder'
import { RetryPaymentButton } from './RetryPaymentButton'

export interface CustomerPortalOrdersProps {
  organization: schemas['Organization']
  orders: schemas['CustomerOrder'][]
  customerSessionToken: string
}

export const CustomerPortalOrders = ({
  organization,
  orders,
  customerSessionToken,
}: CustomerPortalOrdersProps) => {
  const api = createClientSideAPI(customerSessionToken)
  const { retryPayment, isRetrying, isLoading } =
    useRetryPayment(customerSessionToken)

  const themingPreset = useThemePreset(
    organization.slug === 'midday' ? 'midday' : 'polar',
  )

  const [selectedOrder, setSelectedOrder] = useState<
    schemas['CustomerOrder'] | null
  >(null)

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
        wrapperClassName={themingPreset.polar.table}
        headerClassName={themingPreset.polar.tableHeader}
        data={orders ?? []}
        isLoading={false}
        columns={[
          {
            accessorKey: 'product.name',
            header: 'Product',
            cell: ({ row }) => row.original.product.name,
          },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
              <span className="flex flex-shrink">
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
                  <RetryPaymentButton
                    order={order}
                    onRetry={retryPayment}
                    isRetrying={isRetrying(order.id)}
                    isLoading={isLoading(order.id)}
                    themingPreset={themingPreset}
                    className="hidden md:flex"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedOrder(order)
                      showOrderModal()
                    }}
                    className={twMerge(
                      'hidden md:flex',
                      themingPreset.polar.buttonSecondary,
                    )}
                    size="sm"
                  >
                    View Order
                  </Button>
                  <Link
                    className="md:hidden"
                    href={`/${organization.slug}/portal/orders/${order.id}?customer_session_token=${customerSessionToken}`}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      className={twMerge(themingPreset.polar.buttonSecondary)}
                    >
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
