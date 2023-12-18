import {
  AutoStoriesOutlined,
  CategoryOutlined,
  FileDownloadOutlined,
  KeyOutlined,
  MovieOutlined,
} from '@mui/icons-material'

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
  createdAt: Date
}

export interface ProductBundle {
  type: ProductType.BUNDLE
  products: Product[]
}

export const resolveProductTypeIcon = (type: ProductType) => {
  switch (type) {
    case ProductType.LICENSE:
      return KeyOutlined
    case ProductType.FILE:
      return FileDownloadOutlined
    case ProductType.VIDEO_TUTORIAL:
      return MovieOutlined
    case ProductType.BUNDLE:
      return CategoryOutlined
    case ProductType.E_BOOK:
      return AutoStoriesOutlined
    default:
      return () => null
  }
}
