import { Section } from '@/components/Layout/Section'
import { schemas } from '@polar-sh/client'
import { ProductMetadataForm } from '../ProductMetadataForm'
import { ProductCheckoutSection } from './ProductCheckoutSection'
import { ProductCustomerPortalSection } from './ProductCustomerPortalSection'
import { ProductInfoSection } from './ProductInfoSection'
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

const ProductForm = ({
  organization,
  update,
  benefitsSlot,
}: {
  organization: schemas['Organization']
  update?: boolean
  benefitsSlot: React.ReactNode
}) => {
  return (
    <div className="dark:divide-polar-700 flex flex-col divide-y">
      <ProductInfoSection />

      <ProductPricingSection organization={organization} update={update} />

      {benefitsSlot}

      <Section
        title="Metadata"
        description="Optional metadata to associate with the product"
      >
        <ProductMetadataForm />
      </Section>

      <ProductCheckoutSection organization={organization} />

      <ProductCustomerPortalSection />
    </div>
  )
}

export default ProductForm
