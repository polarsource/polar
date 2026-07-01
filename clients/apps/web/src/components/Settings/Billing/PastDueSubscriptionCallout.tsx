'use client'

import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit/Alert'

export const PastDueSubscriptionCallout = ({
  subscription,
}: {
  subscription: schemas['OrganizationSubscription']
}) => {
  if (subscription.status !== 'past_due') {
    return null
  }

  return (
    <Alert
      variant="warning"
      title="Renewal payment failed"
      description="We couldn't process your latest subscription renewal. Update your default payment method to retry the payment and keep your plan active."
    />
  )
}
