'use client'

import { schemas } from '@polar-sh/client'
import { CheckoutPreview } from './CheckoutPreview'

export interface CheckoutCustomizationProps {
  organization: schemas['Organization']
  product?: schemas['Product']
}

export const CheckoutCustomization = ({
  organization,
  product,
}: CheckoutCustomizationProps) => {
  return (
    <>
      <CheckoutPreview organization={organization} product={product} />
      {/* <CheckoutSidebar /> */}
    </>
  )
}
