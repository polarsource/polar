'use client'

import { canRetryOrderPayment } from '@/utils/order'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button, Status, Text, type StatusColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { useMemo, useState } from 'react'
import { OrderDownloadActions } from '../Orders/OrderDownloadActions'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { OrderPaymentRetryModal } from './OrderPaymentRetryModal'
import { PortalDivider, PortalRow, PortalRows } from './PortalPrimitives'
import { SeatManagementTable } from './SeatManagementTable'

const OrderStatusDisplayTitle: Record<schemas['Order']['status'], string> = {
  draft: 'Draft',
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
  void: 'Void',
}

const OrderStatusDisplayColor: Record<schemas['Order']['status'], StatusColor> =
  {
    draft: 'gray',
    paid: 'green',
    pending: 'yellow',
    refunded: 'purple',
    partially_refunded: 'purple',
    void: 'red',
  }

const CustomerPortalOrder = ({
  api,
  order,
  customerSessionToken,
  themingPreset,
}: {
  api: Client
  order: schemas['CustomerOrder']
  customerSessionToken: string
  themingPreset: ThemingPresetProps
}) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  const isPartiallyOrFullyRefunded = useMemo(() => {
    return order.status === 'partially_refunded' || order.status === 'refunded'
  }, [order])

  // Seats management
  const hasSeatBasedOrder = order.seats && order.seats > 0

  // Check customer portal settings for seat management visibility
  const portalSettings = order.product?.organization.customer_portal_settings
  const showSeatManagement = portalSettings?.subscription.update_seats === true

  const format = (amount: number) =>
    formatCurrency('accounting')(amount, order.currency)

  return (
    <Box flexDirection="column" rowGap="3xl">
      <Box flexDirection="column" rowGap="xl">
        <Box
          justifyContent="between"
          alignItems="start"
          columnGap="l"
          rowGap="m"
          flexWrap="wrap"
        >
          <Box flexDirection="column" rowGap="xs" minWidth={0}>
            <Box alignItems="center" columnGap="m" flexWrap="wrap">
              <Text variant="heading-xxs" as="h2">
                {order.description}
              </Text>
              <Status
                size="small"
                status={OrderStatusDisplayTitle[order.status]}
                color={OrderStatusDisplayColor[order.status]}
              />
            </Box>
            <Box as="span" color="text-secondary">
              {new Date(order.created_at).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })}
            </Box>
          </Box>
          {canRetryOrderPayment(order) && (
            <Button size="sm" onClick={() => setIsPaymentModalOpen(true)}>
              Retry payment
            </Button>
          )}
        </Box>

        <PortalRows>
          {order.product && (
            <PortalRow label="Product" value={order.product.name} />
          )}
          <PortalRow label="Invoice number" value={order.invoice_number} />
        </PortalRows>

        {order.items.length > 0 && (
          <PortalRows>
            {order.items.map((item) => (
              <PortalRow
                numeric
                key={item.id}
                label={item.label}
                value={format(item.amount)}
              />
            ))}
          </PortalRows>
        )}

        <PortalDivider />

        <PortalRows>
          <PortalRow
            numeric
            label="Subtotal"
            value={format(order.subtotal_amount)}
          />
          {order.discount_amount ? (
            <PortalRow
              numeric
              label="Discount"
              value={format(-order.discount_amount)}
            />
          ) : null}
          <PortalRow
            numeric
            label="Net amount"
            value={format(order.net_amount)}
          />
          <PortalRow numeric label="Tax" value={format(order.tax_amount)} />
          <PortalRow
            numeric
            emphasis
            label="Total"
            value={format(order.total_amount)}
          />
          {order.applied_balance_amount !== 0 && (
            <>
              <PortalRow
                numeric
                label="Applied balance"
                value={format(order.applied_balance_amount)}
              />
              <PortalRow
                numeric
                emphasis
                label="To be paid"
                value={format(order.due_amount)}
              />
            </>
          )}
          {isPartiallyOrFullyRefunded && (
            <PortalRow
              numeric
              label="Refunded"
              value={format(order.refunded_amount)}
            />
          )}
        </PortalRows>

        {order.paid && (
          <OrderDownloadActions
            order={order}
            customerSessionToken={customerSessionToken}
          />
        )}
      </Box>

      {hasSeatBasedOrder && showSeatManagement && (
        <SeatManagementTable
          api={api}
          identifier={
            order.subscription_id
              ? { subscriptionId: order.subscription_id }
              : { orderId: order.id }
          }
          organizationSlug={order.product?.organization.slug ?? ''}
        />
      )}

      <CustomerPortalGrants
        api={api}
        subscriptionId={order.subscription_id ?? undefined}
        orderId={order.id}
      />

      <OrderPaymentRetryModal
        order={order}
        api={api}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        themingPreset={themingPreset}
      />
    </Box>
  )
}

export default CustomerPortalOrder
