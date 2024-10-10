import {
  CheckoutPublic,
  CheckoutUpdatePublic,
  Organization,
} from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'
import { CheckoutCard } from './CheckoutCard'
import CheckoutProductInfo from './CheckoutProductInfo'

export interface CheckoutInfoProps {
  organization: Organization
  checkout: CheckoutPublic
  onCheckoutUpdate?: (body: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  className?: string
}

export const CheckoutInfo = ({
  organization,
  checkout,
  onCheckoutUpdate,
  className,
}: CheckoutInfoProps) => {
  const { product } = checkout
  return (
    <div
      className={twMerge('flex flex-col gap-y-12 md:w-1/2 md:p-20', className)}
    >
      <CheckoutProductInfo organization={organization} product={product} />
      <CheckoutCard checkout={checkout} onCheckoutUpdate={onCheckoutUpdate} />
    </div>
  )
}
