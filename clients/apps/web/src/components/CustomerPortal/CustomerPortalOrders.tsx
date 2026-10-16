import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatCurrency } from '@polar-sh/currency'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import { OrderStatus } from '../Orders/OrderStatus'
import CustomerPortalOrder from './CustomerPortalOrder'
import {
  PortalCardList,
  PortalEmptyState,
  PortalListItem,
  PortalSection,
} from './PortalPrimitives'

export interface CustomerPortalOrdersProps {
  organization: schemas['CustomerOrganization']
  orders: schemas['CustomerOrder'][]
  customerSessionToken: string
  limit?: number
}

export const CustomerPortalOrders = ({
  organization,
  orders,
  customerSessionToken,
  limit,
}: CustomerPortalOrdersProps) => {
  const api = createClientSideAPI(customerSessionToken)
  const router = useRouter()

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

  const visibleOrders = limit ? orders.slice(0, limit) : orders
  const ordersHref = `/${organization.slug}/portal/orders?customer_session_token=${customerSessionToken}`

  const openOrder = (order: schemas['CustomerOrder']) => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setSelectedOrder(order)
      showOrderModal()
    } else {
      router.push(
        `/${organization.slug}/portal/orders/${order.id}?customer_session_token=${customerSessionToken}`,
      )
    }
  }

  return (
    <PortalSection
      title={limit ? 'Recent orders' : 'All orders'}
      actions={
        limit && orders.length > limit ? (
          <Link href={ordersHref}>
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        ) : undefined
      }
    >
      {visibleOrders.length > 0 ? (
        <PortalCardList>
          {visibleOrders.map((order) => (
            <PortalListItem
              key={order.id}
              onClick={() => openOrder(order)}
              title={order.description}
              subtitle={
                <FormattedDateTime
                  datetime={order.created_at}
                  dateStyle="medium"
                  resolution="day"
                />
              }
              meta={
                <>
                  <OrderStatus status={order.status} size="small" />
                  <Box
                    as="span"
                    color="text-primary"
                    minWidth={72}
                    textAlign="right"
                  >
                    {formatCurrency('compact')(
                      order.total_amount,
                      order.currency,
                    )}
                  </Box>
                </>
              }
            />
          ))}
        </PortalCardList>
      ) : (
        <PortalEmptyState
          title="No orders yet"
          description="Your purchases will show up here."
        />
      )}
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
    </PortalSection>
  )
}
