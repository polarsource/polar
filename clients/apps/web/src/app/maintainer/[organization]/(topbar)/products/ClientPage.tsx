'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Product, ProductType } from '@/components/Products/Product'
import { ProductTile } from '@/components/Products/ProductTile'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { AddOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'

export const productMocks: Product[] = [
  {
    id: '1',
    slug: 'spline-3d-tutorial',
    name: 'Spline 3D Tutorial',
    description:
      'A premium quality course on Spline designed for your comfort and convenience',
    type: ProductType.VIDEO_TUTORIAL,
    price: 9000,
    image:
      'https://cdn.midjourney.com/8c128e1d-ee8e-4923-8f0a-4bcb5ec9b219/0_1.webp',
    unlockable: true,
  },
  {
    id: '2',
    name: 'Product 2',
    slug: 'product-2',
    description:
      'Experience the best with your ultimate choice for superior performance',
    type: ProductType.FILE,
    price: 2000,
    image:
      'https://cdn.midjourney.com/2cd08644-bdbd-4abf-ac23-245ed0cd9d17/0_1.webp',
    unlockable: true,
  },
  {
    id: '5',
    slug: 'product-5',
    name: 'Product 5',
    description: 'Where style meets functionality',
    type: ProductType.FILE,
    price: 5000,
    image:
      'https://cdn.midjourney.com/96289ed6-62e6-4084-b4d8-f27cb06c5040/0_2.webp',
    unlockable: false,
  },
  {
    id: '6',
    slug: 'product-6',
    name: 'Product 6',
    description: 'Discover the power of performance',
    type: ProductType.FILE,
    price: 6000,
    image:
      'https://cdn.midjourney.com/138817cd-5bfe-4ef1-839e-6ad3b1b74629/0_2.webp',
    unlockable: true,
  },
]

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()

  return (
    <DashboardBody>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-medium">Overview</h2>
          <Link href={`/maintainer/${org?.name}/products/new`}>
            <Button className="h-8 w-8 rounded-full">
              <AddOutlined fontSize="inherit" />
            </Button>
          </Link>
        </div>
        <StaggerReveal className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
          {productMocks.map((product) => (
            <StaggerReveal.Child
              key={product.id}
              className="flex flex-grow flex-col"
            >
              <ProductTile product={product} />
            </StaggerReveal.Child>
          ))}
        </StaggerReveal>
      </div>
    </DashboardBody>
  )
}

export default ClientPage
