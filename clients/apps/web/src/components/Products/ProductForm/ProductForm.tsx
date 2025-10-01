import { schemas } from '@polar-sh/client'
import React from 'react'
import { ProductCustomFieldSection } from './ProductCustomFieldSection'
import { ProductInfoSection } from './ProductInfoSection'
import { ProductMediaSection } from './ProductMediaSection'
import { ProductMetadataSection } from './ProductMetadataSection'
import { ProductPricingSection } from './ProductPricingSection'
import { ProductTrialSection } from './ProductTrialSection'

export interface ProductFullMediasMixin {
  full_medias: schemas['ProductMediaFileRead'][]
}

export type ProductFormType = Omit<
  schemas['ProductCreate'] | schemas['ProductUpdate'],
  'metadata'
> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

interface ProductFormProps {
  organization: schemas['Organization']
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
      <ProductPricingSection
        organization={organization}
        update={update}
        compact={compact}
      />
      <ProductTrialSection compact={compact} />
      <ProductMediaSection organization={organization} compact={compact} />
      <ProductCustomFieldSection
        organization={organization}
        compact={compact}
      />
      <ProductMetadataSection compact={compact} />
    </div>
  )
}

export default ProductForm
