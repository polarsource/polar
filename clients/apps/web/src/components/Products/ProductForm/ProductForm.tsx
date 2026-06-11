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

// UI-only "free" price type for the dashboard's "Free" pricing option. It is not part of
// the API: the form converts it to a fixed price of 0 before submitting (see
// `formPriceToApiPrice`). It mirrors the fixed-create shape minus the amount so the
// conversion produces a valid `ProductPriceFixedCreate`.
export type FreeProductPriceCreate = Omit<
  schemas['ProductPriceFixedCreate'],
  'amount_type' | 'price_amount'
> & { amount_type: 'free' }

type ApiProductFormPrice = NonNullable<
  (schemas['ProductCreate'] | schemas['ProductUpdate'])['prices']
>[number]

export type ProductFormPrice = ApiProductFormPrice | FreeProductPriceCreate

export type ProductFormType = Omit<
  schemas['ProductCreate'] | schemas['ProductUpdate'],
  'metadata' | 'prices'
> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
    prices: ProductFormPrice[]
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

      <ProductCustomerPortalSection />

      <ProductCheckoutSection organization={organization} />
    </div>
  )
}

export default ProductForm
