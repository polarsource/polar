'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import type { ExperimentVariant } from '@/experiments'
import { useCheckout } from '@polar-sh/checkout/providers'

const ClientPage = ({
  embed,
  theme,
  layoutVariant,
}: {
  embed: boolean
  theme?: 'light' | 'dark'
  layoutVariant: ExperimentVariant<'checkout_layout_experiment'>
}) => {
  const { checkout } = useCheckout()

  return (
    <CheckoutLayout
      checkout={checkout}
      embed={embed}
      theme={theme}
      layoutVariant={layoutVariant}
    >
      <Checkout embed={embed} theme={theme} layoutVariant={layoutVariant} />
    </CheckoutLayout>
  )
}

export default ClientPage
