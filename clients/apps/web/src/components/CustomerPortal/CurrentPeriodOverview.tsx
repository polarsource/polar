import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import {
  getUnitLabels,
  isFreePrice,
  isSeatBasedPrice,
  isUnitBasedPrice,
} from '@/utils/product'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import AmountLabel from '../Shared/AmountLabel'
import {
  PortalDivider,
  PortalRow,
  PortalRows,
  PortalText,
} from './PortalPrimitives'

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
  const isTrialing = subscription.status === 'trialing'
  const isActive = subscription.status === 'active'
  const isPaused = subscription.status === 'paused'
  const isCancelingAtPeriodEnd =
    subscription.cancel_at_period_end && !subscription.ended_at

  const isResumingCharge =
    (subscription.pause_at_period_end || isPaused) &&
    subscription.resumes_at !== null &&
    !isCancelingAtPeriodEnd
  const isPausingIndefinitely =
    (subscription.pause_at_period_end || isPaused) && !subscription.resumes_at

  const shouldShowPreview =
    (isActive || isTrialing || isResumingCharge) && !isPausingIndefinitely

  const { data: subscriptionPreview } = useCustomerSubscriptionChargePreview(
    api,
    subscription.id,
    shouldShowPreview,
  )
  const productId = useMemo(() => {
    if (subscription.pending_update && subscription.pending_update.product_id) {
      return subscription.pending_update.product_id
    }
    return subscription.product_id
  }, [subscription])
  const product = products.find((product) => product.id === productId)

  // For seat-based subscriptions, surface the number of seats we'll charge for
  // next, preferring a pending update if one is scheduled.
  const seats = useMemo(() => {
    if (
      subscription.pending_update &&
      subscription.pending_update.seats != null
    ) {
      return subscription.pending_update.seats
    }
    return subscription.seats
  }, [subscription])

  const units = useMemo(() => {
    if (
      subscription.pending_update &&
      subscription.pending_update.units != null
    ) {
      return subscription.pending_update.units
    }
    return subscription.units
  }, [subscription])

  if (!shouldShowPreview) {
    return null
  }

  const hasMeters = subscription.meters.length > 0
  const prorations = subscriptionPreview?.prorations ?? []
  const hasProrations = prorations.length > 0
  const hasTaxes = subscriptionPreview && subscriptionPreview.tax_amount > 0
  const hasDiscount =
    subscriptionPreview && subscriptionPreview.discount_amount > 0

  const isFreeProduct = subscription.prices.some(isFreePrice)

  const isSeatBasedProduct = product?.prices.some(
    (price) =>
      price.price_currency === subscription.currency && isSeatBasedPrice(price),
  )

  const unitPrice = product?.prices.find(
    (price): price is schemas['ProductPriceUnitBased'] =>
      price.price_currency === subscription.currency && isUnitBasedPrice(price),
  )
  const isUnitBasedProduct = unitPrice != null
  const { unitLabel, unitLabelPlural } = getUnitLabels(unitPrice)

  // Use the subscription amount (except when a pending update is scheduled)
  // instead of the current product price, since we by default grandfather old subscriptions
  // on their old prices if a product price is updated
  const hasPendingProduct = subscription.pending_update?.product_id != null
  const showLockedBaseAmount =
    !hasPendingProduct &&
    subscriptionPreview != null &&
    subscriptionPreview.base_amount > 0

  // For subscriptions set to cancel, only show if there's still something to
  // bill: metered usage or pending prorations.
  if (isCancelingAtPeriodEnd && !hasMeters && !hasProrations) {
    return null
  }

  // Don't show for free subscriptions with no meters
  const hasNextInvoice = !isFreeProduct || hasMeters
  if (!hasNextInvoice) {
    return null
  }

  const chargeDate = isTrialing
    ? subscription.trial_end
    : isResumingCharge
      ? subscription.resumes_at
      : subscription.current_period_end

  // Determine header and label based on subscription state
  let headerTitle = 'Next charge'
  let dateLabel = 'Due'

  if (isTrialing) {
    headerTitle = 'First charge after trial'
    dateLabel = 'Trial ends'
  } else if (isCancelingAtPeriodEnd) {
    headerTitle = 'Final charge'
    dateLabel = 'Ends'
  } else if (isResumingCharge) {
    headerTitle = 'Charge on resume'
    dateLabel = 'Resumes'
  }

  const productLabel = () => {
    if (!product) {
      return ''
    }
    if (isSeatBasedProduct && seats != null) {
      return `${product.name} (${seats} ${seats === 1 ? 'seat' : 'seats'})`
    }
    if (isUnitBasedProduct && units != null) {
      return `${product.name} (${units} ${units === 1 ? unitLabel : unitLabelPlural})`
    }
    return product.name
  }

  const chargeDateLabel = `${dateLabel} ${
    chargeDate
      ? new Date(chargeDate).toLocaleDateString('en-US', {
          dateStyle: 'medium',
        })
      : 'N/A'
  }`

  const format = (amount: number) =>
    formatCurrency('compact')(amount, subscription.currency)

  const footnote = isCancelingAtPeriodEnd
    ? `This will be the final charge before the subscription ends.${
        hasMeters
          ? ' Final amount may vary based on usage until the end of the billing period.'
          : ''
      }`
    : hasMeters
      ? isActive
        ? 'Final charges may vary based on usage until the end of the billing period.'
        : isTrialing
          ? 'Final charges may vary based on usage during the trial period.'
          : 'Final charges may vary.'
      : null

  return (
    <Box
      flexDirection="column"
      rowGap="m"
      paddingTop="l"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Box as="span" color="text-primary">
          {headerTitle}
        </Box>
        <PortalText tone="secondary" className="text-sm">
          {chargeDateLabel}
        </PortalText>
      </Box>

      <PortalRows>
        {product && subscriptionPreview && (
          <PortalRow
            numeric
            label={productLabel()}
            value={
              isCancelingAtPeriodEnd ? (
                'Canceled'
              ) : showLockedBaseAmount ? (
                <AmountLabel
                  amount={subscriptionPreview.base_amount}
                  currency={subscription.currency}
                  interval={subscription.recurring_interval}
                  intervalCount={subscription.recurring_interval_count}
                />
              ) : (
                <ProductPriceLabel
                  product={product}
                  currency={subscription.currency}
                />
              )
            }
          />
        )}
        {prorations.map((proration, index) => (
          <PortalRow
            numeric
            key={index}
            label={proration.label}
            value={format(proration.amount)}
          />
        ))}
        {subscription.meters.map((meter) => (
          <PortalRow
            numeric
            key={meter.id}
            label={meter.meter.name}
            value={format(meter.amount)}
          />
        ))}
      </PortalRows>

      <PortalDivider />

      <PortalRows>
        {(hasTaxes || hasDiscount) && (
          <PortalRow
            numeric
            label="Subtotal"
            value={format(subscriptionPreview.subtotal_amount)}
          />
        )}
        {hasDiscount && (
          <PortalRow
            numeric
            label="Discount"
            value={format(-1 * subscriptionPreview.discount_amount)}
          />
        )}
        {hasTaxes && (
          <PortalRow
            numeric
            label="Taxes"
            value={format(subscriptionPreview.tax_amount)}
          />
        )}
        <PortalRow
          numeric
          emphasis
          label={hasMeters ? 'Estimated total' : 'Total'}
          value={
            subscriptionPreview ? (
              format(subscriptionPreview.total_amount)
            ) : (
              <PortalText tone="tertiary" className="animate-pulse">
                Loading…
              </PortalText>
            )
          }
        />
        {subscriptionPreview &&
          subscriptionPreview.applied_balance_amount !== 0 && (
            <>
              <PortalRow
                numeric
                label="Applied balance"
                value={format(subscriptionPreview.applied_balance_amount)}
              />
              <PortalRow
                numeric
                emphasis
                label="To be paid"
                value={format(subscriptionPreview.due_amount)}
              />
            </>
          )}
      </PortalRows>

      {footnote && (
        <PortalText tone="tertiary" className="text-xs">
          {footnote}
        </PortalText>
      )}
    </Box>
  )
}
