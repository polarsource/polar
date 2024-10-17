'use client'

import { useEffect } from 'react'

interface CheckoutEmbedLoadedProps {}

const CheckoutEmbedLoaded: React.FC<
  React.PropsWithChildren<CheckoutEmbedLoadedProps>
> = () => {
  useEffect(() => {
    window.parent.postMessage('polarCheckoutLoaded', '*')
  }, [])

  return null
}

export default CheckoutEmbedLoaded
