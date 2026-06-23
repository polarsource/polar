'use client'

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

  if (isDismissed) {
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
