'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { ExperimentProvider } from '@/experiments/ExperimentProvider'
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
  console.log('id', checkout.organization.id)
  return (
    <ExperimentProvider orgId={checkout.organization.id}>
      <CheckoutLayout checkout={checkout} embed={embed} theme={theme}>
        <Checkout embed={embed} theme={theme} locale={locale} />
      </CheckoutLayout>
    </ExperimentProvider>
  )
}

export default ClientPage
