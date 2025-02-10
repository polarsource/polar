import { components } from '@polar-sh/client'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductPillProps {
  product:
    | components['schemas']['Product']
    | components['schemas']['TransactionProduct']
    | components['schemas']['ProductStorefront']
    | components['schemas']['CheckoutProduct']
  price?: components['schemas']['ProductPrice']
}

const ProductPill: React.FC<ProductPillProps> = ({ product, price }) => {
  const color = '#3381FF'
  return (
    <div className="flex items-center justify-between gap-3">
      <div
        style={{ backgroundColor: color }}
        className="dark:text-polar-950 inline-flex gap-1 whitespace-nowrap rounded-xl px-3 py-1 text-xs text-white"
      >
        <div>{product.name}</div>
        {price && (
          <>
            <div>·</div>
            <ProductPriceLabel price={price} />
          </>
        )}
      </div>
    </div>
  )
}

export default ProductPill
