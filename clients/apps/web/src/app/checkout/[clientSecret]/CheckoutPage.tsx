'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { useExperiment } from '@/experiments/client'
import { useCheckout } from '@polar-sh/checkout/providers'
import { AcceptedLocale } from '@polar-sh/i18n'

const ClientPage = ({
  embed,
  theme,
  locale,
}: {
  embed: boolean
  theme?: 'light' | 'dark'
  locale: AcceptedLocale
}) => {
  const { checkout } = useCheckout()
  const { variant: flattenExperiment } = useExperiment('checkout_flatten')

  return (
    <CheckoutLayout
      checkout={checkout}
      embed={embed}
      theme={theme}
      flat={!embed && flattenExperiment === 'treatment'}
    >
      <Checkout embed={embed} theme={theme} locale={locale} />
    </CheckoutLayout>
  )
}

export default ClientPage
