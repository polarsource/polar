export enum ProductType {
  LICENSE = 'License',
  FILE = 'File Download',
}

export interface Product {
  id: string
  name: string
  description: string
  type: ProductType
  price: number
  image: string
  inStock: number
  unlockable?: boolean
}
