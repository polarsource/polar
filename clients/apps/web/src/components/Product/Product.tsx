import {
  CategoryOutlined,
  FileDownloadOutlined,
  KeyOutlined,
  MovieOutlined,
} from '@mui/icons-material'

export enum ProductType {
  LICENSE = 'License',
  DIGITAL = 'Digital',
  TUTORIAL = 'Tutorial',
  BUNDLE = 'Bundle',
}

export interface BaseProduct {
  id: string
  slug: string
  name: string
  description: string
  type: ProductType
  price: number
  image: string
  unlockable: boolean
  organization: {
    name: string
    avatarUrl: string
  }
  createdAt: Date
}

export interface BundleProduct extends BaseProduct {
  type: ProductType.BUNDLE
  products: Product
}

export interface FileProduct extends BaseProduct {
  type: ProductType.DIGITAL
  files: {
    name: string
    url: string
    size: number
  }[]
}

export interface TutorialProduct extends BaseProduct {
  type: ProductType.TUTORIAL
  videos: {
    name: string
    url: string
    duration: number
  }[]
}

export interface LicenseProduct extends BaseProduct {
  type: ProductType.LICENSE
  license: {
    key: string
  }
}

export type Product =
  | LicenseProduct
  | TutorialProduct
  | FileProduct
  | BundleProduct

export const resolveProductTypeIcon = (type: ProductType) => {
  switch (type) {
    case ProductType.LICENSE:
      return KeyOutlined
    case ProductType.DIGITAL:
      return FileDownloadOutlined
    case ProductType.TUTORIAL:
      return MovieOutlined
    case ProductType.BUNDLE:
      return CategoryOutlined
    default:
      return () => null
  }
}
