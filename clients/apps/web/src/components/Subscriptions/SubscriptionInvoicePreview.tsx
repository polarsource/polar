'use client'

import {
  InvoicePreview,
  type InvoiceLineItem,
} from '@/components/Orders/InvoicePreview'
import { OrderSection } from '@/components/Orders/OrderSection'
import { useProduct } from '@/hooks/queries'
import { useSubscriptionChargePreview } from '@/hooks/queries/subscriptions'
import { isFreePrice, isSeatBasedPrice } from '@/utils/product'
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
  const hasMeters = subscription.meters.length > 0
  const hasProrations = (chargePreview?.prorations.length ?? 0) > 0
  const hasNextInvoice = !isFreeProduct || hasMeters || hasProrations

  if (!showsCharge || !hasNextInvoice || !chargePreview) {
    return null
  }

  const usageSeparate = chargePreview.meter_charge != null
  const metersOnBase = hasMeters && !usageSeparate
  const overageMeters = subscription.meters.filter((meter) => meter.amount > 0)
  const showUsage = usageSeparate && overageMeters.length > 0

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
    ...(metersOnBase
      ? subscription.meters.map((meter) => ({
          id: meter.id,
          label: meter.meter.name,
          amount: meter.amount,
        }))
      : []),
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
        metersOnBase
          ? ' Final amount may vary based on usage until the end of the billing period.'
          : ''
      }`
    : metersOnBase
      ? 'Final charges may vary based on usage until the end of the billing period.'
      : null

  const meterCharge = chargePreview.meter_charge
  const usageDate = subscription.current_meter_period_end

  return (
    <Box
      flexDirection="column"
      rowGap={showUsage ? '4xl' : undefined}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingTop="4xl"
    >
      {showUsage && meterCharge && (
        <OrderSection
          title="Upcoming usage charge"
          description={
            <Box alignItems="center" columnGap="s">
              <Text color="muted">Next invoice</Text>
              {usageDate && (
                <>
                  <Text color="muted">·</Text>
                  <Text color="muted">
                    <FormattedDateTime
                      dateStyle="medium"
                      datetime={usageDate}
                    />
                  </Text>
                </>
              )}
            </Box>
          }
        >
          <InvoicePreview
            currency={subscription.currency}
            items={overageMeters.map((meter) => ({
              id: meter.id,
              label: meter.meter.name,
              amount: meter.amount,
            }))}
            subtotalAmount={meterCharge.subtotal_amount}
            discountAmount={meterCharge.discount_amount}
            netAmount={meterCharge.net_amount}
            taxAmount={meterCharge.tax_amount}
            totalAmount={meterCharge.total_amount}
          />
          <Text color="muted">
            Final amount may vary based on usage until the end of the usage
            period.
          </Text>
        </OrderSection>
      )}
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
