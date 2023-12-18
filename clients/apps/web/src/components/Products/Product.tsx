export enum ProductType {
  LICENSE = 'License',
  FILE = 'File Download',
  VIDEO_TUTORIAL = 'Video Tutorial',
  BUNDLE = 'Bundle',
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

export interface VideoTutorialProduct extends Product {
  type: ProductType.VIDEO_TUTORIAL
  meta: {
    duration: number
  }
}

export interface ProductBundle {
  type: ProductType.BUNDLE
  products: Product[]
}
