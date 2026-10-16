import AmountLabel from '@/components/Shared/AmountLabel'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PortalText } from './PortalPrimitives'
import { useMemo } from 'react'
import { getCustomerSubscriptionBasePrice } from './pricing'
import { SubscriptionStatusPill } from './SubscriptionStatusPill'

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

  const showBasePrice =
    !hasPendingProduct &&
    subscription.amount &&
    subscriptionBasePrice &&
    subscription.amount < subscriptionBasePrice.amount

  return (
    <Box flexDirection="column" rowGap="xs" minWidth={0}>
      <Box alignItems="center" columnGap="m" rowGap="xs" flexWrap="wrap">
        <Text variant="heading-xxs" as="h3">
          {subscription.product.name}
        </Text>
        <SubscriptionStatusPill subscription={subscription} />
      </Box>
      <PortalText tone="secondary" className="tabular-nums">
        {subscription.amount && subscription.currency ? (
          <>
            {showBasePrice && (
              <span className="mr-1.5 line-through opacity-60">
                {formatCurrency('compact')(
                  subscriptionBasePrice.amount,
                  subscriptionBasePrice.currency,
                )}
              </span>
            )}
            <AmountLabel
              amount={subscription.amount}
              currency={subscription.currency}
              interval={subscription.recurring_interval}
              intervalCount={subscription.recurring_interval_count}
            />
          </>
        ) : (
          'Free'
        )}
      </PortalText>
    </Box>
  )
}
