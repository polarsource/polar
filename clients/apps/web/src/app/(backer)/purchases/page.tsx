'use client'

import { productMocks } from '@/app/maintainer/[organization]/(topbar)/products/data'
import { ProductTile } from '@/components/Product/ProductTile'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useState } from 'react'

export default function Page() {
  const [presentation, setPresentation] = useState<'grid' | 'list'>('list')

  const Presentation =
    presentation === 'grid' ? (
      <div className="grid grid-cols-2 gap-8">
        {productMocks.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
    ) : (
      <div className="flex flex-col gap-y-2">
        {productMocks.map((product) => (
          <div
            key={product.id}
            className="dark:bg-polar-900 dark:border-polar-800 dark:hover:bg-polar-800 flex flex-row justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
          >
            <div className="flex flex-row items-center gap-x-4">
              <div
                className="dark:bg-polar-700 aspect-square w-16 rounded-xl bg-gray-100 bg-cover bg-center"
                style={{ backgroundImage: `url(${product.image})` }}
              />
              <div className="flex flex-col">
                <h3 className="font-medium">{product.name}</h3>
                <div className="dark:text-polar-500 flex flex-row gap-x-1 text-sm text-gray-500">
                  <span>{product.type}</span>
                </div>
              </div>
            </div>
            <div></div>
          </div>
        ))}
      </div>
    )

  return (
    <div className="relative flex flex-row items-start gap-x-12">
      <ShadowBoxOnMd className="w-1/4"></ShadowBoxOnMd>
      <div className="flex w-3/4 flex-col gap-y-8 pb-12">{Presentation}</div>
    </div>
  )
}
