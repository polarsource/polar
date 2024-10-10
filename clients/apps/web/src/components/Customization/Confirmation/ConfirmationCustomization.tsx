import { Product } from '@polar-sh/sdk'
import { ConfirmationPreview } from './ConfirmationPreview'

export interface ConfirmationCustomizationProps {
  product?: Product
}

export const ConfirmationCustomization = ({
  product,
}: ConfirmationCustomizationProps) => {
  return (
    <>
      <ConfirmationPreview product={product} />
      {/* <ConfirmationSidebar /> */}
    </>
  )
}
