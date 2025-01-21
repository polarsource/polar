import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { twMerge } from 'tailwind-merge'
import { CheckoutCard } from './CheckoutCard'
import CheckoutProductInfo from './CheckoutProductInfo'

export interface CheckoutInfoProps {
  checkout: CheckoutPublic
  className?: string
}

export const CheckoutInfo = ({ checkout, className }: CheckoutInfoProps) => {
  const { product, organization } = checkout
  return (
    <div className={twMerge('flex flex-col gap-y-8 md:p-12', className)}>
      <CheckoutProductInfo organization={organization} product={product} />
      <CheckoutCard checkout={checkout} />
    </div>
  )
}
