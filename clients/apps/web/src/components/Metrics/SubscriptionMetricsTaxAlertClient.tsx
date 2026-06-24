'use client'

import { useSubscriptions } from '@/hooks/queries'
import { useDismissed } from '@/hooks/useDismissed'
import { Alert } from '@polar-sh/orbit'

interface SubscriptionMetricsTaxAlertClientProps {
  organizationId: string
}

export const SubscriptionMetricsTaxAlertClient = ({
  organizationId,
}: SubscriptionMetricsTaxAlertClientProps) => {
  const { isDismissed, dismiss } = useDismissed(
    `subscription_metrics_tax_alert:${organizationId}`,
  )

  const { data: subscriptions } = useSubscriptions(organizationId, {
    limit: 1,
    sorting: ['-amount'],
  })
  const hasPaidSubscription = (subscriptions?.items[0]?.amount ?? 0) > 0

  if (isDismissed || !hasPaidSubscription) {
    return null
  }

  return (
    <Alert
      variant="info"
      title="Subscription metrics now exclude tax"
      description="We corrected subscription metrics to be tax-exclusive, matching your revenue metrics. Because your organization uses location-based or inclusive tax behavior, these subscription metrics may be a bit lower than before."
      onDismiss={dismiss}
    />
  )
}
