import { ProductCard } from '@/components/Products/ProductCard'
import { Product } from '@/hooks/queries/products'
import { organizationPageLink } from '@/utils/nav'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'

export default function ClientPage({
  organization,
  products,
}: {
  organization: Organization
  products: Product[]
}) {
  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-xl">Products</h2>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={organizationPageLink(organization, `products/${product.id}`)}
          >
            <ProductCard product={product} />
          </Link>
        ))}
      </div>
    </div>
  )
}
