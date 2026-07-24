'use client'

import {
  InvoicePreview,
  type InvoiceLineItem,
} from '@/components/Shared/InvoicePreview'
import { Section } from '@/components/Shared/Section'
import { useProduct } from '@/hooks/queries'
import { useSubscriptionChargePreview } from '@/hooks/queries/subscriptions'
import { isFreePrice, isSeatBasedPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useMemo } from 'react'
import { getChargePreviewMeta } from './subscriptionState'

const SubscriptionInvoicePreview = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const { visible, chargeDate, title, dateLabel, isCancelingAtPeriodEnd } =
    getChargePreviewMeta(subscription)

  const { data: chargePreview } = useSubscriptionChargePreview(
    subscription.id,
    {
      enabled: visible,
    },
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
  const hasNextInvoice = !isFreeProduct || hasMeters

  if (!visible || !hasNextInvoice || !chargePreview) {
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
      <Section
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
        />
        {note && <Text color="muted">{note}</Text>}
      </Section>
    </Box>
  )
}

export default SubscriptionInvoicePreview
