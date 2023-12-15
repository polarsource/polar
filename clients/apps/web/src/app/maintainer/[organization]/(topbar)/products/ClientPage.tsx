'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Product, ProductType } from '@/components/Products/Product'
import { ProductTile } from '@/components/Products/ProductTile'

const productMocks: Product[] = [
  {
    id: '1',
    name: 'Product 1',
    description:
      'A premium quality item designed for your comfort and convenience',
    type: ProductType.FILE,
    price: 10,
    image:
      'https://cdn.midjourney.com/8c128e1d-ee8e-4923-8f0a-4bcb5ec9b219/0_1.webp',
    inStock: 10,
    unlockable: true,
  },
  {
    id: '2',
    name: 'Product 2',
    description:
      'Experience the best with your ultimate choice for superior performance',
    type: ProductType.FILE,
    price: 20,
    image:
      'https://cdn.midjourney.com/2cd08644-bdbd-4abf-ac23-245ed0cd9d17/0_1.webp',
    inStock: 20,
    unlockable: true,
  },
  {
    id: '3',
    name: 'Product 3',
    description: 'Combining innovation and efficiency in one package',
    type: ProductType.FILE,
    price: 30,
    image:
      'https://cdn.midjourney.com/7600f2c4-b1c4-4b40-a30b-9bab630546fd/0_3.webp',
    inStock: 30,
  },
  {
    id: '4',
    name: 'Product 4',
    description: 'Unparalleled quality and outstanding features',
    type: ProductType.FILE,
    price: 40,
    image:
      'https://cdn.midjourney.com/433f223b-1e30-46b7-a8b6-78ca903dc8a0/0_1.webp',
    inStock: 40,
  },
  {
    id: '5',
    name: 'Product 5',
    description: 'Where style meets functionality',
    type: ProductType.FILE,
    price: 50,
    image:
      'https://cdn.midjourney.com/96289ed6-62e6-4084-b4d8-f27cb06c5040/0_2.webp',
    inStock: 50,
  },
  {
    id: '6',
    name: 'Product 6',
    description: 'Discover the power of performance',
    type: ProductType.FILE,
    price: 60,
    image:
      'https://cdn.midjourney.com/138817cd-5bfe-4ef1-839e-6ad3b1b74629/0_2.webp',
    inStock: 60,
    unlockable: true,
  },
  {
    id: '7',
    name: 'Product 7',
    description: 'Engineered for excellence',
    type: ProductType.FILE,
    price: 70,
    image:
      'https://cdn.midjourney.com/15853b06-8660-4fef-a2b7-8cf2bb1292a7/0_0.webp',
    inStock: 70,
  },
  {
    id: '8',
    name: 'Product 8',
    description: 'A blend of sophistication and utility',
    type: ProductType.FILE,
    price: 80,
    image:
      'https://cdn.midjourney.com/f24f20e3-2c17-44de-a2fb-e238b16369b6/0_1.webp',
    inStock: 80,
    unlockable: true,
  },
]

const ClientPage = () => {
  return (
    <DashboardBody>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-medium">Overview</h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
          {productMocks.map((product) => (
            <ProductTile key={product.id} product={product} />
          ))}
        </div>
      </div>
    </DashboardBody>
  )
}

export default ClientPage
