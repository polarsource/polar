'use client'

import { components } from '@polar-sh/client'
import { CheckoutPreview } from './CheckoutPreview'

export interface CheckoutCustomizationProps {
  product?: components['schemas']['Product']
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
