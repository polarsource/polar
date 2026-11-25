'use client'

import {
  InvoicePreview,
  type InvoiceLineItem,
} from '@/components/Orders/InvoicePreview'
import { useProduct } from '@/hooks/queries'
import { useSubscriptionChargePreview } from '@/hooks/queries/subscriptions'
import { isFreePrice, isSeatBasedPrice } from '@/utils/product'
import {
  billsUsageOnMeterCycle,
  formatBilledMeterUnits,
} from '@/utils/subscription'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'

export interface UpcomingCharge {
  title: string
  chargeDate: string | null
  items: InvoiceLineItem[]
  preview: schemas['SubscriptionChargePreview']
  note: string | null
}

// The next charge the subscription will make, if it will make one.
export const useSubscriptionUpcomingCharge = (
  subscription: schemas['Subscription'],
): UpcomingCharge | null => {
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
      description: formatBilledMeterUnits(meter),
      amount: meter.amount,
    })),
  ]

  const chargeDate = isTrialing
    ? subscription.trial_end
    : isResumingCharge
      ? subscription.resumes_at
      : subscription.current_period_end

  let title = 'Upcoming renewal'
  if (isTrialing) {
    title = 'First charge after trial'
  } else if (isCancelingAtPeriodEnd) {
    title = 'Final charge'
  } else if (isResumingCharge) {
    title = 'Charge on resume'
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

  return { title, chargeDate, items, preview: chargePreview, note }
}

// The lines of the invoice the upcoming charge will make.
const SubscriptionInvoicePreview = ({
  subscription,
  charge: { items, preview, note },
}: {
  subscription: schemas['Subscription']
  charge: UpcomingCharge
}) => (
  <Box flexDirection="column" rowGap="m" paddingHorizontal="m" paddingTop="s">
    <InvoicePreview
      currency={subscription.currency}
      items={items}
      subtotalAmount={preview.subtotal_amount}
      discountAmount={preview.discount_amount}
      netAmount={preview.net_amount}
      taxAmount={preview.tax_amount}
      totalAmount={preview.total_amount}
      appliedBalanceAmount={preview.applied_balance_amount}
      dueAmount={preview.due_amount}
    />
    {note && <Text color="muted">{note}</Text>}
  </Box>
)

export default SubscriptionInvoicePreview
