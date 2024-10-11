import { CONFIG } from '@/utils/config'
import { Product } from '@polar-sh/sdk'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

export interface ProductCheckoutModalProps {
  product: Product
}

export const ProductCheckoutModal = ({
  product,
}: ProductCheckoutModalProps) => {
  return (
    <ShadowBox className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-xl font-medium">Checkout URL</h3>
        <p className="dark:text-polar-500 text-gray-500">
          Generate a product-link which you can share to your customers or
          integrate in your own product
        </p>
      </div>
      <h1 className="text-xl">{product.name}</h1>
      <div className="flex flex-col gap-y-6">
        {product.prices.map((price) => (
          <div className="flex flex-col gap-y-2">
            <span className="text-sm font-medium">
              {price.type === 'recurring'
                ? price.recurring_interval === 'month'
                  ? 'Monthly Pricing'
                  : 'Yearly Pricing'
                : 'Checkout URL'}
            </span>
            <CopyToClipboardInput
              key={price.id}
              value={new URL(
                `${CONFIG.PRODUCT_LINK_BASE_URL}${price.id}`,
              ).toString()}
            />
          </div>
        ))}
      </div>
    </ShadowBox>
  )
}
