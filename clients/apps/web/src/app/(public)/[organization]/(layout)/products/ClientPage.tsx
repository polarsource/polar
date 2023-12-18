'use client'

import { productMocks } from '@/app/maintainer/[organization]/(topbar)/products/data'
import { ProductTile } from '@/components/Product/ProductTile'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'

const ClientPage = ({ organization }: { organization: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-y-8">
      <div className="flex flex-row items-center justify-between">
        <h2 className="text-lg font-medium">Products</h2>
      </div>
      <StaggerReveal className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {productMocks.map((product) => (
          <StaggerReveal.Child
            key={product.id}
            className="flex flex-grow flex-col"
          >
            <Link href={`/${organization?.name}/products/${product.slug}`}>
              <ProductTile product={product} />
            </Link>
          </StaggerReveal.Child>
        ))}
      </StaggerReveal>
    </div>
  )
}

export default ClientPage
