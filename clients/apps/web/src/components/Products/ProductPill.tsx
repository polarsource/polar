import { schemas } from '@polar-sh/client'

interface ProductPillProps {
  product:
    | schemas['Product']
    | schemas['TransactionProduct']
    | schemas['ProductStorefront']
    | schemas['CheckoutProduct']
}

const ProductPill: React.FC<ProductPillProps> = ({ product }) => {
  const color = '#3381FF'
  return (
    <div className="flex items-center justify-between gap-3">
      <div
        style={{ backgroundColor: color }}
        className="dark:text-polar-950 inline-flex gap-1 rounded-xl px-3 py-1 text-xs whitespace-nowrap text-white"
      >
        <div>{product.name}</div>
      </div>
    </div>
  )
}

export default ProductPill
