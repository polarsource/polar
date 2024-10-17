'use client'

import { Checkout } from '@/components/Checkout/Checkout'
import { CheckoutPublic, Organization } from '@polar-sh/sdk'
import { useTheme } from 'next-themes'

export default function ClientPage({
  organization,
  checkout,
}: {
  organization: Organization
  checkout: CheckoutPublic
}) {
  const { resolvedTheme } = useTheme()
  return (
    <Checkout
      checkout={checkout}
      organization={organization}
      theme={resolvedTheme as 'light' | 'dark'}
    />
  )
}
