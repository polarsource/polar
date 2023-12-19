import { Product, ProductType } from '@/components/Product/Product'

const lipsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut ac pretium nunc. Ut pulvinar commodo purus. Mauris sed scelerisque ligula, vel accumsan magna. Quisque eu sem eget urna iaculis mattis eu eu mauris.\n\nInteger faucibus blandit ligula sed fermentum. Nam luctus libero ac hendrerit eleifend. Integer luctus ligula sollicitudin ligula porta, sed mollis neque pretium.`

const createdAt = new Date(`2023-0${Math.round(Math.random() * 9)}-01`)

export const productMocks: Product[] = [
  {
    id: '1',
    slug: 'spline-3d-tutorial',
    name: 'Spline 3D Tutorial',
    description: lipsum,
    type: ProductType.VIDEO_TUTORIAL,
    organization: {
      name: 'emilwidlund',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1025102?v=4',
    },
    price: 9000,
    image:
      'https://cdn.midjourney.com/8c128e1d-ee8e-4923-8f0a-4bcb5ec9b219/0_1.webp',
    unlockable: true,
    createdAt,
  },
  {
    id: '2',
    name: 'Product 2',
    slug: 'product-2',
    description: lipsum,
    type: ProductType.FILE,
    organization: {
      name: 'emilwidlund',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1025102?v=4',
    },
    price: 2000,
    image:
      'https://cdn.midjourney.com/2cd08644-bdbd-4abf-ac23-245ed0cd9d17/0_1.webp',
    unlockable: true,
    createdAt,
  },
  {
    id: '5',
    slug: 'product-5',
    name: 'Product 5',
    description: lipsum,
    type: ProductType.FILE,
    organization: {
      name: 'emilwidlund',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1025102?v=4',
    },
    price: 5000,
    image:
      'https://cdn.midjourney.com/96289ed6-62e6-4084-b4d8-f27cb06c5040/0_2.webp',
    unlockable: false,
    createdAt,
  },
  {
    id: '6',
    slug: 'product-6',
    name: 'Product 6',
    description: lipsum,
    type: ProductType.FILE,
    organization: {
      name: 'emilwidlund',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1025102?v=4',
    },
    price: 6000,
    image:
      'https://cdn.midjourney.com/138817cd-5bfe-4ef1-839e-6ad3b1b74629/0_2.webp',
    unlockable: true,
    createdAt,
  },
]
