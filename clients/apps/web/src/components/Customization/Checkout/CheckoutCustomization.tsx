'use client'

import { Product } from '@polar-sh/sdk'
import { CheckoutPreview } from './CheckoutPreview'

export interface CheckoutCustomizationProps {
  product?: Product
}

export const CheckoutCustomization = ({
  product,
}: CheckoutCustomizationProps) => {
  return (
    <>
      <CheckoutPreview product={product} />
      {/* <CheckoutSidebar /> */}
    </>
  )
}
