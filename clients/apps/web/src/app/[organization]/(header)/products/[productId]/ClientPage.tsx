import { Checkout } from '@/components/Checkout/Checkout'
import { CheckoutPublic, Organization } from '@polar-sh/sdk'

export default function ClientPage({
  organization,
  checkout,
}: {
  organization: Organization
  checkout: CheckoutPublic
}) {
  return <Checkout checkout={checkout} organization={organization} />
}
