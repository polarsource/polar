'use client'

import Checkout from '@/components/Checkout/Checkout'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { useCheckout } from '@spaire/checkout/providers'

const ClientPage = ({
  embed,
  theme,
}: {
  embed: boolean
  theme?: 'light' | 'dark'
}) => {
  const { checkout } = useCheckout()

  return (
    <CheckoutLayout checkout={checkout} embed={embed} theme={theme}>
      <Checkout embed={embed} theme={theme} />
    </CheckoutLayout>
  )
}

export default ClientPage
