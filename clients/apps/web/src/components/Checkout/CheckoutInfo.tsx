import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { twMerge } from 'tailwind-merge'
import { CheckoutCard } from './CheckoutCard'
import CheckoutProductInfo from './CheckoutProductInfo'

export interface CheckoutInfoProps {
  checkout: CheckoutPublic
  className?: string
  themePreset: ThemingPresetProps
}

export const CheckoutInfo = ({
  checkout,
  className,
  themePreset,
}: CheckoutInfoProps) => {
  const { product, organization } = checkout
  return (
    <div className={twMerge('flex flex-col gap-y-8 md:p-12', className)}>
      <CheckoutProductInfo organization={organization} product={product} />
      <CheckoutCard checkout={checkout} themePreset={themePreset} />
    </div>
  )
}
