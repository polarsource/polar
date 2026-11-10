'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { useCheckout } from '@polar-sh/checkout/providers'
import { AcceptedLocale, getLocaleDirection } from '@polar-sh/i18n'

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

  return (
    <CheckoutLayout
      checkout={checkout}
      embed={embed}
      theme={theme}
      dir={getLocaleDirection(locale)}
    >
      <Checkout embed={embed} theme={theme} locale={locale} />
    </CheckoutLayout>
  )
}

export default ClientPage
