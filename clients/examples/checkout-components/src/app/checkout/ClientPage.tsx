'use client'

import { CheckoutForm } from '@polar-sh/checkout/components'
import { useCheckoutForm } from '@polar-sh/checkout/providers'

const ClientPage = () => {
  const props = useCheckoutForm()
  return <CheckoutForm {...props} />
}

export default ClientPage
