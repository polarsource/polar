'use client'

import { productMocks } from '@/app/maintainer/[organization]/(topbar)/products/data'
import { VideoPlayer } from '@/components/Product/VideoPlayer'
import { useParams } from 'next/navigation'
import { Avatar, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'

export default function Page() {
  const { id } = useParams()

  const product = productMocks.find((product) => product.id === id)

  if (!product) return null

  return (
    <div className="relative flex flex-col gap-y-12">
      <VideoPlayer source="/videos/sample.mp4" poster={product.image} />
      <div className="flex flex-row gap-x-12">
        <ShadowBoxOnMd className="flex w-2/3 flex-col gap-y-4">
          <h3 className="font-medium">{product.name}</h3>
          <div className="flex flex-row items-center gap-x-2">
            <Avatar
              className="h-8 w-8"
              name={product.organization.name}
              avatar_url={product.organization.avatarUrl}
            />
            <span className="text-sm">{product.organization.name}</span>
          </div>
          <div>
            <p className="dark:text-polar-500 text-gray-500">
              {product.description}
            </p>
          </div>
        </ShadowBoxOnMd>
        <ShadowBoxOnMd className="flex w-1/3 flex-col"></ShadowBoxOnMd>
      </div>
    </div>
  )
}
