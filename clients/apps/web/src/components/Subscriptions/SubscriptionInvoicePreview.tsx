'use client'

import {
  InvoicePreview,
  type InvoiceLineItem,
} from '@/components/Orders/InvoicePreview'
import { OrderSection } from '@/components/Orders/OrderSection'
import { useProduct } from '@/hooks/queries'
import { useSubscriptionChargePreview } from '@/hooks/queries/subscriptions'
import { isFreePrice, isSeatBasedPrice } from '@/utils/product'
import { billsUsageOnMeterCycle } from '@/utils/subscription'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useMemo } from 'react'

const SubscriptionInvoicePreview = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const isTrialing = subscription.status === 'trialing'
  const isActive = subscription.status === 'active'
  const isPaused = subscription.status === 'paused'

  const isCancelingAtPeriodEnd =
    subscription.cancel_at_period_end && !subscription.ended_at

  const isPausing = subscription.pause_at_period_end || isPaused
  const isResumingCharge =
    isPausing && subscription.resumes_at !== null && !isCancelingAtPeriodEnd
  const isPausingIndefinitely = isPausing && !subscription.resumes_at

  // The query and the render below share one gate: a narrower `enabled` leaves
  // states that render the preview without ever fetching it.
  const showsCharge =
    (isActive || isTrialing || isResumingCharge) && !isPausingIndefinitely

  const { data: chargePreview } = useSubscriptionChargePreview(
    subscription.id,
    { enabled: showsCharge },
  )

  const productId = useMemo(
    () => subscription.pending_update?.product_id ?? subscription.product_id,
    [subscription],
  )
  const { data: product } = useProduct(productId)

  const seats = useMemo(
    () => subscription.pending_update?.seats ?? subscription.seats,
    [subscription],
  )

  const isFreeProduct = subscription.prices.some(isFreePrice)
  // Usage settled on an earlier meter cycle is shown by SubscriptionUsageChargePreview
  const usageOnMeterCycle = billsUsageOnMeterCycle(subscription)
  const hasMeters = subscription.meters.length > 0 && !usageOnMeterCycle

  if (!showsCharge || !chargePreview) {
    return null
  }

  const hasNextInvoice =
    !isFreeProduct ||
    hasMeters ||
    chargePreview.base_amount > 0 ||
    chargePreview.prorations.length > 0
  if (!hasNextInvoice) {
    return null
  }

  if (
    isCancelingAtPeriodEnd &&
    usageOnMeterCycle &&
    chargePreview.prorations.length === 0
  ) {
    return null
  }

  const isSeatBasedProduct = product?.prices.some(
    (price) =>
      price.price_currency === subscription.currency && isSeatBasedPrice(price),
  )

  const productName = product?.name ?? subscription.product.name
  const baseLabel =
    isSeatBasedProduct && seats != null
      ? `${productName} (${seats} ${seats === 1 ? 'seat' : 'seats'})`
      : productName

  const items: InvoiceLineItem[] = [
    { id: 'base', label: baseLabel, amount: chargePreview.base_amount },
    ...(chargePreview.prorations ?? []).map((proration, index) => ({
      id: `proration-${index}`,
      label: proration.label,
      amount: proration.amount,
    })),
    ...(hasMeters ? subscription.meters : []).map((meter) => ({
      id: meter.id,
      label: meter.meter.name,
      amount: meter.amount,
    })),
  ]

  const chargeDate = isTrialing
    ? subscription.trial_end
    : isResumingCharge
      ? subscription.resumes_at
      : subscription.current_period_end

  let title = 'Upcoming renewal'
  let dateLabel = 'Next invoice'
  if (isTrialing) {
    title = 'First charge after trial'
    dateLabel = 'Trial ends'
  } else if (isCancelingAtPeriodEnd) {
    title = 'Final charge'
    dateLabel = 'Subscription ends'
  } else if (isResumingCharge) {
    title = 'Charge on resume'
    dateLabel = 'Resumes'
  }

  const note = isCancelingAtPeriodEnd
    ? `This will be the final charge when the subscription ends.${
        hasMeters
          ? ' Final amount may vary based on usage until the end of the billing period.'
          : ''
      }`
    : hasMeters
      ? 'Final charges may vary based on usage until the end of the billing period.'
      : null

  return (
    <Box
      flexDirection="column"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingTop="4xl"
    >
      <OrderSection
        title={title}
        description={
          <Box alignItems="center" columnGap="s">
            <Text color="muted">{dateLabel}</Text>
            {chargeDate && (
              <>
                <Text color="muted">·</Text>
                <Text color="muted">
                  <FormattedDateTime dateStyle="medium" datetime={chargeDate} />
                </Text>
              </>
            )}
          </Box>
        }
      >
        <InvoicePreview
          currency={subscription.currency}
          items={items}
          subtotalAmount={chargePreview.subtotal_amount}
          discountAmount={chargePreview.discount_amount}
          netAmount={chargePreview.net_amount}
          taxAmount={chargePreview.tax_amount}
          totalAmount={chargePreview.total_amount}
          appliedBalanceAmount={chargePreview.applied_balance_amount}
          dueAmount={chargePreview.due_amount}
        />
        {note && <Text color="muted">{note}</Text>}
      </OrderSection>
    </Box>
  )
}

export default SubscriptionInvoicePreview
