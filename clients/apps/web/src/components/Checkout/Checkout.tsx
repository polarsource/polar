import { Organization, Product } from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutInfo } from './CheckoutInfo'

export interface CheckoutProps {
  organization: Organization
  product: Product
  disabled?: boolean
}

export const Checkout = (props: CheckoutProps) => {
  return (
    <ShadowBox className="dark:border-polar-700 flex w-full max-w-7xl flex-row items-stretch divide-x border p-0">
      <CheckoutInfo {...props} />
      <CheckoutForm {...props} />
    </ShadowBox>
  )
}
