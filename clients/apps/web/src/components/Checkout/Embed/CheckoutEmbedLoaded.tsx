'use client'

import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import type { schemas } from '@polar-sh/client'
import { useEffect } from 'react'

interface CheckoutEmbedLoadedProps {
  checkout: schemas['CheckoutPublic']
}

const CheckoutEmbedLoaded: React.FC<
  React.PropsWithChildren<CheckoutEmbedLoadedProps>
> = ({ checkout }) => {
  const embedOrigin = checkout.embed_origin
  useEffect(() => {
    if (!embedOrigin) {
      return
    }
    PolarEmbedCheckout.postMessage({ event: 'loaded' }, embedOrigin)
  }, [embedOrigin])

  return null
}

export default CheckoutEmbedLoaded
