export enum ProductType {
  LICENSE = 'License',
  FILE = 'File Download',
  VIDEO_TUTORIAL = 'Video Tutorial',
  BUNDLE = 'Bundle',
  E_BOOK = 'E-Book',
}

export interface Product {
  id: string
  slug: string
  name: string
  description: string
  type: ProductType
  price: number
  image: string
  unlockable: boolean
}

export interface ProductBundle {
  type: ProductType.BUNDLE
  products: Product[]
}
