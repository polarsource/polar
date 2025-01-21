'use client'

import Checkout from '@/components/Checkout/Checkout'
import { CheckoutContextProvider } from '@/components/Checkout/CheckoutContextProvider'
import { CheckoutPublic, Organization } from '@polar-sh/api'

export default function ClientPage({
  checkout,
}: {
  organization: Organization
  checkout: CheckoutPublic
}) {
  return (
    <CheckoutContextProvider clientSecret={checkout.client_secret}>
      <Checkout />
    </CheckoutContextProvider>
  )
}
