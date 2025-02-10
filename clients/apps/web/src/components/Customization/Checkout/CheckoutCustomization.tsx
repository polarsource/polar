'use client'

import { schemas } from '@polar-sh/client'
import { CheckoutPreview } from './CheckoutPreview'

export interface CheckoutCustomizationProps {
  product?: schemas['Product']
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
