import { Section } from '@/components/Layout/Section'
import { schemas } from '@polar-sh/client'
import React from 'react'
import { ProductMetadataForm } from '../ProductMetadataForm'
import { ProductCustomFieldSection } from './ProductCustomFieldSection'
import { ProductInfoSection } from './ProductInfoSection'
import { ProductMediaSection } from './ProductMediaSection'
import { ProductPricingSection } from './ProductPricingSection'

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
}

const ProductForm: React.FC<ProductFormProps> = ({ organization, update }) => {
  return (
    <div className="dark:divide-polar-700 flex flex-col divide-y">
      <ProductInfoSection />
      <ProductPricingSection organization={organization} update={update} />
      <ProductMediaSection organization={organization} />
      <ProductCustomFieldSection organization={organization} />
      <Section
        title="Metadata"
        description="Optional metadata to associate with the product"
      >
        <ProductMetadataForm />
      </Section>
    </div>
  )
}

export default ProductForm
