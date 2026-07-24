'use client'

import { canRetryOrderPayment } from '@/utils/order'
import { Client, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Status, type StatusColor } from '@polar-sh/orbit'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { useMemo, useState } from 'react'
import { OrderDownloadActions } from '../Orders/OrderDownloadActions'
import { InvoicePreview } from '../Shared/InvoicePreview'
import { DetailItem } from '../Shared/Section'
import { CustomerPortalGrants } from './CustomerPortalGrants'
import { OrderPaymentRetryModal } from './OrderPaymentRetryModal'
import { SeatManagementTable } from './SeatManagementTable'

const OrderStatusDisplayTitle: Record<schemas['Order']['status'], string> = {
  draft: 'Draft',
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
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

  return (
    <Box flexDirection="column" rowGap="3xl">
      <Box width="100%" flexDirection="column" rowGap="2xl">
        <Box flexWrap="wrap" alignItems="center" columnGap="l">
          <Text variant="heading-s" as="h3">
            {order.description}
          </Text>
          <Status
            status={OrderStatusDisplayTitle[order.status]}
            color={OrderStatusDisplayColor[order.status]}
          />

          {canRetryOrderPayment(order) && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              Retry payment
            </Button>
          )}
        </Box>

        <Box flexDirection="column" rowGap="2xl">
          <Box flexDirection="column">
            {order.product && (
              <DetailItem label="Product" value={order.product.name} />
            )}
            <DetailItem label="Invoice number" value={order.invoice_number} />
            <DetailItem
              label="Date"
              value={new Date(order.created_at).toLocaleDateString()}
            />
          </Box>

          <InvoicePreview
            currency={order.currency}
            items={order.items.map((item) => ({
              id: item.id,
              label: item.label,
              amount: item.amount,
            }))}
            subtotalAmount={order.subtotal_amount}
            discountAmount={order.discount_amount}
            netAmount={order.net_amount}
            taxAmount={order.tax_amount}
            totalAmount={order.total_amount}
            appliedBalanceAmount={order.applied_balance_amount}
            dueAmount={order.due_amount}
            refundedAmount={
              isPartiallyOrFullyRefunded ? order.refunded_amount : null
            }
          />

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
      </Box>

      {/* Payment Retry Modal */}
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
