import {
  Organization,
  ProductCreate,
  ProductMediaFileRead,
  ProductUpdate,
} from '@polar-sh/sdk'
import React from 'react'
import { ProductInfoSection } from './ProductInfoSection'
import { ProductMediaSection } from './ProductMediaSection'
import { ProductPricingSection } from './ProductPricingSection'

export interface ProductFullMediasMixin {
  full_medias: ProductMediaFileRead[]
}

export type ProductFormType = (ProductCreate | ProductUpdate) &
  ProductFullMediasMixin

interface ProductFormProps {
  organization: Organization
  update?: boolean
}

const ProductForm: React.FC<ProductFormProps> = ({ organization, update }) => {
  return (
    <div className="flex flex-col divide-y">
      <ProductInfoSection />
      <ProductPricingSection update={update} />
      <ProductMediaSection organization={organization} />
    </div>
  )
}

export default ProductForm
