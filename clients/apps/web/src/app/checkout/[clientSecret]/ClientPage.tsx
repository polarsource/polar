'use client'

import Checkout from '@/components/Checkout/Checkout'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'

const ClientPage = ({
  checkout,
  embed,
  theme,
  prefilledParameters,
}: {
  checkout: CheckoutPublic
  embed: boolean
  prefilledParameters: Record<string, string>
  theme?: 'light' | 'dark'
}) => {
  return (
    <Checkout
      clientSecret={checkout.clientSecret}
      prefilledParameters={prefilledParameters}
      theme={theme}
      embed={embed}
    />
  )
}

export default ClientPage
