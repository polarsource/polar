'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrderSecondaryDetails } from '@/components/Orders/OrderSecondaryDetails'
import { OrderCalloutBanner } from '@/components/Orders/OrderCalloutBanner'
import { OrderDetails } from '@/components/Orders/OrderDetails'
import { OrderDisputesTable } from '@/components/Orders/OrderDisputesTable'
import { OrderPaymentsTable } from '@/components/Orders/OrderPaymentsTable'
import { OrderRefundsSection } from '@/components/Orders/OrderRefundsSection'
import { OrderSeatsSection } from '@/components/Orders/OrderSeatsSection'
import { OrderSection } from '@/components/Orders/OrderSection'
import { OrderStatus } from '@/components/Orders/OrderStatus'
import { DownloadInvoiceDashboard } from '@/components/Orders/DownloadInvoice'
import { DownloadReceiptDashboard } from '@/components/Orders/DownloadReceipt'
import { InvoicePreview } from '@/components/Orders/InvoicePreview'
import { toast } from '@/components/Toast/use-toast'
import { useCustomFields, useProduct, useSubscription } from '@/hooks/queries'
import { useOrder } from '@/hooks/queries/orders'
import { usePayments } from '@/hooks/queries/payments'
import {
  isOrderDunningFailed,
  isOrderInDunning,
  isOrderInDunningLifecycle,
} from '@/utils/order'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import React from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  order: schemas['Order']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  order: _order,
}) => {
  const { data: order, refetch: refetchOrder } = useOrder(_order.id, _order)
  const { data: product } = useProduct(_order.product_id)
  const { data: customFields } = useCustomFields(organization.id)
  const { data: payments, isLoading: paymentsLoading } = usePayments(
    organization.id,
    { order_id: _order.id },
  )

  const orderPayments = payments?.items ?? []
  const inDunningLifecycle =
    !!order && isOrderInDunningLifecycle(order, orderPayments)

  const { data: dunningSubscription } = useSubscription(
    order?.subscription_id ?? '',
    undefined,
    { enabled: inDunningLifecycle },
  )

  const showDunningBanner =
    !!order &&
    !!dunningSubscription &&
    (isOrderInDunning(order, orderPayments) ||
      isOrderDunningFailed(order, dunningSubscription, orderPayments))

  if (!order) {
    return null
  }

  return (
    <DashboardBody
      title={
        <Box alignItems="center" columnGap="l">
          <Text variant="heading-xs" as="h2">
            Order
          </Text>
          <OrderStatus status={order.status} />
        </Box>
      }
      header={
        <Box alignItems="center" columnGap="l">
          {order.paid && (
            <>
              <DownloadInvoiceDashboard
                order={order}
                organization={organization}
                onInvoiceGenerated={refetchOrder}
              />
              {order.receipt_number != null && (
                <DownloadReceiptDashboard
                  organization={organization}
                  order={order}
                  className="w-auto"
                  variant="secondary"
                />
              )}
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon">
                <MoreVertOutlined fontSize="small" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard
                    .writeText(order.id)
                    .then(() =>
                      toast({
                        title: 'Order ID copied',
                        description:
                          'The order ID has been copied to clipboard',
                      }),
                    )
                    .catch(() =>
                      toast({
                        title: 'Failed to copy',
                        description: 'Could not copy the order ID to clipboard',
                      }),
                    )
                }}
              >
                Copy Order ID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      }
      className="gap-y-16"
      contextViewTitle="Customer"
      contextView={
        <CustomerContextView
          organization={organization}
          customer={order.customer}
        />
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:shadow-none"
    >
      {showDunningBanner && dunningSubscription ? (
        <OrderCalloutBanner
          organization={organization}
          order={order}
          subscription={dunningSubscription}
          payments={orderPayments}
        />
      ) : null}

      <OrderDetails
        order={order}
        product={product}
        organization={organization}
      />

      <Box
        flexDirection="column"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        paddingTop="4xl"
      >
        <OrderSection title="Charge">
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
            refundedAmount={order.refunded_amount}
          />
        </OrderSection>
      </Box>

      <OrderSecondaryDetails order={order} customFields={customFields?.items} />

      <OrderPaymentsTable
        payments={orderPayments}
        isLoading={paymentsLoading}
      />

      <OrderRefundsSection order={order} />

      <OrderDisputesTable organization={organization} order={order} />

      <OrderSeatsSection order={order} />

      <Box
        flexDirection="column"
        rowGap="l"
        display={{ base: 'flex', md: 'none' }}
      >
        <Text variant="heading-xs" as="h3">
          Customer
        </Text>
        <CustomerContextView
          organization={organization}
          customer={order.customer}
        />
      </Box>
    </DashboardBody>
  )
}

export default ClientPage
