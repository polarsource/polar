'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import CheckoutV2 from '@/components/Checkout/CheckoutV2'
import type { ExperimentVariant } from '@/experiments'
import { useCheckout } from '@polar-sh/checkout/providers'

const ClientPage = ({
  embed,
  theme,
  merchantAvatarVariant,
  checkoutV2Variant,
}: {
  embed: boolean
  theme?: 'light' | 'dark'
  merchantAvatarVariant: ExperimentVariant<'checkout_merchant_avatar_experiment'>
  checkoutV2Variant: ExperimentVariant<'checkout_v2_experiment'>
}) => {
  const { checkout } = useCheckout()

  if (checkoutV2Variant === 'control') {
    return (
      <CheckoutLayout checkout={checkout} embed={embed} theme={theme}>
        <CheckoutV2 embed={embed} theme={theme} />
      </CheckoutLayout>
    )
  }

  return (
    <CheckoutLayout checkout={checkout} embed={embed} theme={theme}>
      <Checkout
        embed={embed}
        theme={theme}
        merchantAvatarVariant={merchantAvatarVariant}
      />
    </CheckoutLayout>
  )
}

export default ClientPage
