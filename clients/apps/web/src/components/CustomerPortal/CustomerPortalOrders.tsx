import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { DataTable } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import CustomerPortalOrder from './CustomerPortalOrder'
import { OrderStatus } from './OrderStatus'
import { useTranslations } from './PortalLocaleProvider'

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
  const t = useTranslations()
  const api = createClientSideAPI(customerSessionToken)

  const [selectedOrder, setSelectedOrder] = useState<
    schemas['CustomerOrder'] | null
  >(null)

  const theme = useTheme()
  const themingPreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')

  const {
    isShown: isOrderModalOpen,
    hide: hideOrderModal,
    show: showOrderModal,
  } = useModal()

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-xl">{t('portal.orders.orderHistory')}</h3>
      </div>
      <DataTable
        data={orders ?? []}
        isLoading={false}
        columns={[
          {
            accessorKey: 'description',
            header: t('portal.orders.description'),
          },
          {
            accessorKey: 'status',
            header: t('portal.common.status'),
            cell: ({ row }) => (
              <span className="flex shrink">
                <OrderStatus status={row.original.status} />
              </span>
            ),
          },
          {
            accessorKey: 'created_at',
            header: t('portal.common.date'),
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
                    {t('portal.orders.viewOrder')}
                  </Button>
                  <Link
                    className="md:hidden"
                    href={`/${organization.slug}/portal/orders/${order.id}?customer_session_token=${customerSessionToken}`}
                  >
                    <Button variant="secondary" size="sm">
                      {t('portal.orders.viewOrder')}
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
          ) : null
        }
      />
    </div>
  )
}
