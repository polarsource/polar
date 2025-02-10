import { components } from '@polar-sh/client'
import React from 'react'
import { ProductCustomFieldSection } from './ProductCustomFieldSection'
import { ProductInfoSection } from './ProductInfoSection'
import { ProductMediaSection } from './ProductMediaSection'
import { ProductPricingSection } from './ProductPricingSection'

export interface ProductFullMediasMixin {
  full_medias: components['schemas']['ProductMediaFileRead'][]
}

export type ProductFormType = (
  | components['schemas']['ProductCreate']
  | components['schemas']['ProductUpdate']
) &
  ProductFullMediasMixin

interface ProductFormProps {
  organization: components['schemas']['Organization']
  update?: boolean
  compact?: boolean
}

const ProductForm: React.FC<ProductFormProps> = ({
  organization,
  update,
  compact,
}) => {
  return (
    <div className="dark:divide-polar-700 flex flex-col divide-y">
      <ProductInfoSection compact={compact} />
      <ProductPricingSection update={update} compact={compact} />
      <ProductMediaSection organization={organization} compact={compact} />
      <ProductCustomFieldSection
        organization={organization}
        compact={compact}
      />
    </div>
  )
}

export default ProductForm
