'use client'

import { productMocks } from '@/app/maintainer/[organization]/(topbar)/products/data'
import { Product, ProductType } from '@/components/Product/Product'
import { ProductTile } from '@/components/Product/ProductTile'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import Link from 'next/link'
import { useCallback } from 'react'

export default function Page() {
  const getProductPathType = useCallback((product: Product) => {
    const buildPath = (subPath: string) => `/purchases/${subPath}/${product.id}`

    switch (product.type) {
      case ProductType.VIDEO_TUTORIAL:
        return buildPath('video')
      case ProductType.E_BOOK:
        return buildPath('book')
      case ProductType.LICENSE:
        return buildPath('license')
      case ProductType.FILE:
      default:
        return buildPath('file')
    }
  }, [])

  return (
    <div className="relative flex flex-col items-start">
      <StaggerReveal className="grid grid-cols-4 gap-8">
        {productMocks.map((product) => (
          <StaggerReveal.Child key={product.id}>
            <Link href={getProductPathType(product)}>
              <ProductTile product={product} />
            </Link>
          </StaggerReveal.Child>
        ))}
      </StaggerReveal>
    </div>
  )
}
