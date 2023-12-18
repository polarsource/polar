'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ProductType } from '@/components/Products/Product'
import {
  FileDownloadOutlined,
  KeyOutlined,
  VideoLibraryOutlined,
} from '@mui/icons-material'
import {
  Input,
  MoneyInput,
  ShadowBoxOnMd,
  TextArea,
} from 'polarkit/components/ui/atoms'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const productTypes = [
  {
    name: ProductType.FILE,
    icon: (
      <FileDownloadOutlined
        className="text-blue-500 dark:text-blue-400"
        fontSize="large"
      />
    ),
    description: 'A file or collection of files that can be downloaded',
  },
  {
    name: ProductType.VIDEO_TUTORIAL,
    icon: (
      <VideoLibraryOutlined
        className="text-blue-500 dark:text-blue-400"
        fontSize="large"
      />
    ),
    description: 'An in-depth, comprehensive video tutorial',
  },
  {
    name: ProductType.LICENSE,
    icon: (
      <KeyOutlined
        className="text-blue-500 dark:text-blue-400"
        fontSize="large"
      />
    ),
    description: 'A license to use a product or service',
  },
] as const

const ClientPage = () => {
  const [selectedType, setSelectedType] = useState<ProductType>(
    ProductType.FILE,
  )

  return (
    <DashboardBody>
      <div className="flex w-full flex-col gap-y-8">
        <h2 className="text-lg font-medium">Edit Product</h2>
        <ShadowBoxOnMd className="flex w-2/3 flex-col items-start gap-y-6">
          <div className="flex min-w-[260px] flex-col gap-y-2">
            <span className="text-sm">Name</span>
            <Input placeholder="Name" defaultValue="" />
          </div>
          <div className="flex w-full flex-col gap-y-2">
            <span className="text-sm">Description</span>
            <TextArea placeholder="Description" defaultValue="" />
          </div>
          <div className="flex min-w-[260px] flex-col gap-y-2">
            <span className="text-sm">Price</span>
            <MoneyInput id="price" name="price" placeholder={0} value={0} />
          </div>
        </ShadowBoxOnMd>
        <ProductTypeSelector
          selectedType={selectedType}
          onSelectType={setSelectedType}
        />
      </div>
    </DashboardBody>
  )
}

export default ClientPage

interface ProductTypeSelectorProps {
  selectedType: ProductType
  onSelectType: (productType: ProductType) => void
}

const ProductTypeSelector = ({
  selectedType,
  onSelectType,
}: ProductTypeSelectorProps) => {
  return (
    <div className="grid w-2/3 grid-cols-3 gap-4">
      {productTypes.map((productType) => (
        <div
          className={twMerge(
            'dark:border-polar-700 dark:bg-polar-900 flex cursor-pointer flex-col gap-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm',
            selectedType === productType.name &&
              'border-blue-500 dark:border-blue-400',
          )}
          onClick={onSelectType.bind(null, productType.name)}
        >
          {productType.icon}
          <div className="flex flex-col gap-y-2">
            <h3 className="dark:text-polar-50 font-medium text-gray-950">
              {productType.name}
            </h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {productType.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
