'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import type { ExperimentVariant } from '@/experiments'
import { useCheckout } from '@polar-sh/checkout/providers'

const ClientPage = ({
  embed,
  theme,
  merchantAvatarVariant,
}: {
  embed: boolean
  theme?: 'light' | 'dark'
  merchantAvatarVariant: ExperimentVariant<'checkout_merchant_avatar_experiment'>
}) => {
  const { checkout } = useCheckout()

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
