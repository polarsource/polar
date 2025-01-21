'use client'

import Checkout from '@/components/Checkout/Checkout'
import { CheckoutPublic, Organization } from '@polar-sh/api'
import { useTheme } from 'next-themes'

export default function ClientPage({
  checkout,
}: {
  organization: Organization
  checkout: CheckoutPublic
}) {
  const { resolvedTheme } = useTheme()
  return (
    <Checkout
      clientSecret={checkout.client_secret}
      prefilledParameters={{}}
      theme={resolvedTheme as 'light' | 'dark'}
    />
  )
}
