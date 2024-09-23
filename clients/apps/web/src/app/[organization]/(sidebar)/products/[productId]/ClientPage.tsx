import { Checkout } from '@/components/Checkout/Checkout'
import { Organization, Product } from '@polar-sh/sdk'

export default function ClientPage({
  organization,
  product,
}: {
  organization: Organization
  product: Product
}) {
  return <Checkout organization={organization} product={product} />
}
