'use client'

import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { CheckoutPublic } from '@polar-sh/sdk'
import { useEffect } from 'react'

interface CheckoutEmbedLoadedProps {
  checkout: CheckoutPublic
}

const CheckoutEmbedLoaded: React.FC<
  React.PropsWithChildren<CheckoutEmbedLoadedProps>
> = ({ checkout }) => {
  useEffect(() => {
    if (!checkout.embed_origin) {
      return
    }
    PolarEmbedCheckout.postMessage({ event: 'loaded' }, checkout.embed_origin)
  }, [])

  return null
}

export default CheckoutEmbedLoaded
