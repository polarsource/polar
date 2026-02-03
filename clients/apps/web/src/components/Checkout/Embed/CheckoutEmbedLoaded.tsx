'use client'

import { SpaireEmbedCheckout } from '@spaire/checkout/embed'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { useEffect } from 'react'

interface CheckoutEmbedLoadedProps {
  checkout: CheckoutPublic
}

const CheckoutEmbedLoaded: React.FC<
  React.PropsWithChildren<CheckoutEmbedLoadedProps>
> = ({ checkout }) => {
  useEffect(() => {
    if (!checkout.embedOrigin) {
      return
    }
    SpaireEmbedCheckout.postMessage({ event: 'loaded' }, checkout.embedOrigin)
  }, [])

  return null
}

export default CheckoutEmbedLoaded
