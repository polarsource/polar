import AmountLabel from '@/components/Shared/AmountLabel'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { getCustomerSubscriptionBasePrice } from './pricing'

export const CustomerSubscriptionHeader = ({
  subscription,
}: {
  subscription: schemas['CustomerSubscription']
}) => {
  const hasPendingProduct = subscription.pending_update?.product_id != null

  const subscriptionBasePrice = useMemo(
    () => getCustomerSubscriptionBasePrice(subscription),
    [subscription],
  )

  // A pending product change reprices the subscription, so the current base
  // price is no longer the one being struck through.
  const discountedFromBasePrice =
    !hasPendingProduct &&
    subscriptionBasePrice != null &&
    subscription.amount !== subscriptionBasePrice.amount

  return (
    <Box alignItems="baseline" columnGap="xl">
      <Text variant="heading-xs" as="h3" truncate>
        {subscription.product.name}
      </Text>
      <Box alignItems="baseline" columnGap="xs">
        {subscription.amount && subscription.currency ? (
          <>
            {discountedFromBasePrice && (
              <Text as="span" variant="body" color="muted" lineThrough>
                {formatCurrency('compact')(
                  subscriptionBasePrice.amount,
                  subscriptionBasePrice.currency,
                )}
              </Text>
            )}
            <Text as="div" variant="body" color="muted">
              <AmountLabel
                amount={subscription.amount}
                currency={subscription.currency}
                interval={subscription.recurring_interval}
                intervalCount={subscription.recurring_interval_count}
              />
            </Text>
          </>
        ) : (
          <Text as="span" variant="body" color="muted">
            Free
          </Text>
        )}
      </Box>
    </Box>
  )
}
