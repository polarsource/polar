'use client'

import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { useEffect } from 'react'

interface CheckoutEmbedLoadedProps {}

const CheckoutEmbedLoaded: React.FC<
  React.PropsWithChildren<CheckoutEmbedLoadedProps>
> = () => {
  useEffect(() => {
    PolarEmbedCheckout.postMessage({ event: 'loaded' })
  }, [])

  return null
}

export default CheckoutEmbedLoaded
