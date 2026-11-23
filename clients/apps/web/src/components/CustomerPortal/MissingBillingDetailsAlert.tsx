import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { getTaxAddressFields } from '@polar-sh/ui/lib/taxAddressFields'

const hasCompleteBillingAddress = (
  address: schemas['CustomerPortalCustomer']['billing_address'],
) =>
  !!address &&
  getTaxAddressFields(address.country).every((field) => !!address[field])

export const MissingBillingDetailsAlert = ({
  customer,
}: {
  customer: schemas['CustomerPortalCustomer']
}) => {
  const missing = [
    !customer.default_payment_method_id && 'a payment method',
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
