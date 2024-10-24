'use client'

import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

const CheckoutEmbedExample = () => {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    PolarEmbedCheckout.init()
  }, [])

  return (
    <>
      <a
        href="https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_hw-6948303Yy9xny3IJQ35MWFtE1U04gzDCAF-rR18M/redirect"
        data-polar-checkout
        data-polar-checkout-theme={resolvedTheme as 'light' | 'dark'}
      >
        Purchase Test Product
      </a>
    </>
  )
}

export default CheckoutEmbedExample
