import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import { isFreePrice, isSeatBasedPrice } from '@/utils/product'
import { Client, schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { useMemo } from 'react'
import { InvoicePreview, type InvoiceLineItem } from '../Shared/InvoicePreview'
import { getChargePreviewMeta } from '../Subscriptions/subscriptionState'
import { OverviewSummaryCard } from './OverviewSummaryCard'

interface CurrentPeriodOverviewProps {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
  api: Client
}

export const CurrentPeriodOverview = ({
  subscription,
  products,
  api,
}: CurrentPeriodOverviewProps) => {
  const { visible, chargeDate, title, dateLabel, isCancelingAtPeriodEnd } =
    getChargePreviewMeta(subscription)

  const { data: chargePreview } = useCustomerSubscriptionChargePreview(
    api,
    subscription.id,
    visible,
  )

  const productId = useMemo(
    () => subscription.pending_update?.product_id ?? subscription.product_id,
    [subscription],
  )
  const product = products.find((product) => product.id === productId)

  const seats = useMemo(
    () => subscription.pending_update?.seats ?? subscription.seats,
    [subscription],
  )

  const hasMeters = subscription.meters.length > 0
  const isFreeProduct = subscription.prices.some(isFreePrice)
  const hasNextInvoice = !isFreeProduct || hasMeters
  const hasProrations = (chargePreview?.prorations ?? []).length > 0

  if (!visible || !hasNextInvoice || !chargePreview) {
    return null
  }

  // Once set to cancel, only worth showing if something is still billable.
  if (isCancelingAtPeriodEnd && !hasMeters && !hasProrations) {
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
    ...subscription.meters.map((meter) => ({
      id: meter.id,
      label: meter.meter.name,
      amount: meter.amount,
    })),
  ]

  const formattedChargeDate = chargeDate
    ? new Date(chargeDate).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : 'N/A'

  const meteredNote =
    subscription.status === 'trialing'
      ? 'Final charges may vary based on usage during the trial period.'
      : 'Final charges may vary based on usage until the end of the billing period.'

  const note = isCancelingAtPeriodEnd
    ? `This will be the final charge when the subscription ends.${
        hasMeters ? ` ${meteredNote}` : ''
      }`
    : hasMeters
      ? meteredNote
      : null

  return (
    <OverviewSummaryCard
      title={title}
      meta={`${dateLabel} · ${formattedChargeDate}`}
    >
      <InvoicePreview
        currency={subscription.currency}
        items={items}
        subtotalAmount={chargePreview.subtotal_amount}
        discountAmount={chargePreview.discount_amount}
        netAmount={chargePreview.net_amount}
        taxAmount={chargePreview.tax_amount}
        totalAmount={chargePreview.total_amount}
      />
      {note && <Text color="muted">{note}</Text>}
    </OverviewSummaryCard>
  )
}
