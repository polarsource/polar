'use client'

import Checkout from '@/components/Checkout/Checkout'
import { CheckoutContextProvider } from '@/components/Checkout/CheckoutContextProvider'
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
    <CheckoutContextProvider
      clientSecret={checkout.clientSecret}
      embed={embed}
      theme={theme}
      prefilledParameters={prefilledParameters}
    >
      <Checkout />
    </CheckoutContextProvider>
  )
}

export default ClientPage
