'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import type { ExperimentVariant } from '@/experiments'
import {
  type SupportedLocale,
  useCheckout,
} from '@polar-sh/checkout/providers'

const ClientPage = ({
  embed,
  theme,
  merchantAvatarVariant,
  locale,
}: {
  embed: boolean
  theme?: 'light' | 'dark'
  merchantAvatarVariant: ExperimentVariant<'checkout_merchant_avatar_experiment'>
  locale: SupportedLocale
}) => {
  const { checkout } = useCheckout()

  return (
    <CheckoutLayout checkout={checkout} embed={embed} theme={theme}>
      <Checkout
        embed={embed}
        theme={theme}
        merchantAvatarVariant={merchantAvatarVariant}
        locale={locale}
      />
    </CheckoutLayout>
  )
}

export default ClientPage
