'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import type { CheckoutDirection } from '@/utils/checkout'
import { useCheckout } from '@polar-sh/checkout/providers'
import { AcceptedLocale } from '@polar-sh/i18n'

const ClientPage = ({
  embed,
  theme,
  locale,
  dir,
}: {
  embed: boolean
  theme?: 'light' | 'dark'
  locale: AcceptedLocale
  dir: CheckoutDirection
}) => {
  const { checkout } = useCheckout()

  return (
    <CheckoutLayout checkout={checkout} embed={embed} theme={theme} dir={dir}>
      <Checkout embed={embed} theme={theme} locale={locale} />
    </CheckoutLayout>
  )
}

export default ClientPage
