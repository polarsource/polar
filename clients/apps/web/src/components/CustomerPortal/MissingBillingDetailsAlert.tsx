import { isMeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { getTaxAddressFields } from '@polar-sh/ui/lib/taxAddressFields'

export const hasCompleteBillingAddress = (
  address: schemas['CustomerPortalCustomer']['billing_address'],
) =>
  !!address &&
  getTaxAddressFields(address.country).every((field) => !!address[field])

// Mirrors Subscription.requires_payment_method on the backend.
const willBeCharged = (subscription: schemas['CustomerSubscription']) => {
  switch (subscription.status) {
    case 'trial_ended':
    case 'past_due':
      return true
    case 'paused':
      return !!subscription.resumes_at
    case 'active':
    case 'trialing':
      return (
        !subscription.cancel_at_period_end ||
        subscription.prices.some(isMeteredPrice)
      )
    default:
      return false
  }
}

export const MissingBillingDetailsAlert = ({
  customer,
  subscriptions,
}: {
  customer: schemas['CustomerPortalCustomer']
  subscriptions: schemas['CustomerSubscription'][]
}) => {
  const charged = subscriptions.filter(willBeCharged)
  const missing = [
    charged.some(
      (s) => !s.payment_method_id && !customer.default_payment_method_id,
    ) && 'a payment method',
    charged.length > 0 &&
      !hasCompleteBillingAddress(customer.billing_address) &&
      'a billing address',
  ].filter(Boolean)

  if (missing.length === 0) {
    return null
  }

  return (
    <Alert
      variant="warning"
      title="Future charges may fail"
      description={`Add ${missing.join(' and ')} to keep your subscriptions running without interruption.`}
    />
  )
}
