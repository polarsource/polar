import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DataTable } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useState } from 'react'
import { InlineModal } from '@polar-sh/orbit'
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
  const themingPreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')

  const {
    isShown: isOrderModalOpen,
    hide: hideOrderModal,
    show: showOrderModal,
  } = useModal()

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between">
        <Text variant="heading-xs" as="h3">
          Order history
        </Text>
      </Box>
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
              <Box flexShrink={1}>
                <OrderStatus status={row.original.status} />
              </Box>
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
                <Box justifyContent="end" columnGap="s">
                  <Box display={{ base: 'none', md: 'flex' }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedOrder(order)
                        showOrderModal()
                      }}
                      size="sm"
                    >
                      View order
                    </Button>
                  </Box>
                  <Box display={{ base: 'flex', md: 'none' }}>
                    <Link
                      href={`/${organization.slug}/portal/orders/${order.id}?customer_session_token=${customerSessionToken}`}
                    >
                      <Button variant="secondary" size="sm">
                        View order
                      </Button>
                    </Link>
                  </Box>
                </Box>
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
            <Box flexDirection="column" overflowY="auto" padding="2xl">
              <CustomerPortalOrder
                api={api}
                order={selectedOrder}
                customerSessionToken={customerSessionToken}
                themingPreset={themingPreset}
              />
            </Box>
          ) : null
        }
      />
    </Box>
  )
}
