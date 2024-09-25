import {
  CheckoutPublic,
  Organization,
  Product,
  ProductPrice,
} from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { CheckoutForm } from './CheckoutForm'
import { CheckoutInfo } from './CheckoutInfo'

export interface CheckoutProps {
  organization: Organization
  product: Product
  price: ProductPrice
  checkout?: CheckoutPublic
}

export const Checkout = (props: CheckoutProps) => {
  return (
    <ShadowBox className="dark:border-polar-700 dark:divide-polar-700 flex w-full max-w-7xl flex-row items-stretch divide-x divide-gray-100 border border-gray-100 p-0">
      <CheckoutInfo {...props} />
      <CheckoutForm checkout={props.checkout} />
    </ShadowBox>
  )
}
