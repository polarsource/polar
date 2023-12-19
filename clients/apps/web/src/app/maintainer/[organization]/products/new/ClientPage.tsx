'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  ProductType,
  resolveProductTypeIcon,
} from '@/components/Product/Product'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import { CloseOutlined, UploadFileOutlined } from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  MoneyInput,
  ShadowBoxOnMd,
  TextArea,
} from 'polarkit/components/ui/atoms'
import {
  ChangeEventHandler,
  Dispatch,
  DragEventHandler,
  SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

const productTypes = [
  {
    name: ProductType.DIGITAL,
    icon: resolveProductTypeIcon(ProductType.DIGITAL),
    description: 'A file or collection of files that can be downloaded',
  },
  {
    name: ProductType.TUTORIAL,
    icon: resolveProductTypeIcon(ProductType.TUTORIAL),
    description: 'An in-depth, comprehensive video tutorial',
  },
  {
    name: ProductType.LICENSE,
    icon: resolveProductTypeIcon(ProductType.LICENSE),
    description: 'A license to use a product or service',
  },
  {
    name: ProductType.BUNDLE,
    icon: resolveProductTypeIcon(ProductType.BUNDLE),
    description: 'Create a bundle of existing products',
  },
] as const

const ClientPage = () => {
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const [price, setPrice] = useState(0)
  const [thumbnail, setThumbnail] = useState<string>()
  const [selectedType, setSelectedType] = useState<ProductType>(
    ProductType.DIGITAL,
  )

  const router = useRouter()

  const shouldRenderUploadManager = useMemo(
    () =>
      [ProductType.DIGITAL, ProductType.TUTORIAL].some(
        (type) => type === selectedType,
      ),
    [selectedType],
  )

  const handleThumbnailInputChange: ChangeEventHandler<HTMLInputElement> =
    useCallback(
      (e) => {
        if (e.target instanceof HTMLInputElement && e.target.files?.[0]) {
          setThumbnail(URL.createObjectURL(e.target.files?.[0]))
        }
      },
      [setThumbnail],
    )

  const handleThumbnailUploadClick = useCallback(() => {
    thumbnailInputRef.current?.click()
  }, [])

  return (
    <>
      <DashboardTopbar title="New Product" useOrgFromURL />
      <DashboardBody className="pb-16">
        <div className="flex w-full flex-col gap-y-12">
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
              <MoneyInput
                id="price"
                name="price"
                placeholder={0}
                value={price}
                onAmountChangeInCents={setPrice}
              />
            </div>
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <span className="text-sm">Thumbnail</span>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  A thumbnail to use when displaying your product on Polar.
                  Minimum 500x500 pixels.
                </p>
              </div>
              <div className="flex flex-col items-start gap-y-4">
                <input
                  ref={thumbnailInputRef}
                  onChange={handleThumbnailInputChange}
                  accept="image/png, image/jpeg"
                  className="hidden"
                  id="file_input"
                  type="file"
                />
                {thumbnail && (
                  <div
                    className="aspect-square w-64 rounded-3xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${thumbnail})` }}
                  />
                )}
                <Button
                  variant="secondary"
                  onClick={handleThumbnailUploadClick}
                >
                  Select File
                </Button>
              </div>
            </div>
          </ShadowBoxOnMd>
          <ProductTypeSelector
            selectedType={selectedType}
            onSelectType={setSelectedType}
          />
          {shouldRenderUploadManager && <ProductUploadManager />}
          <div className="flex flex-row gap-2">
            <Button>Continue</Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </DashboardBody>
    </>
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
    <div className="flex flex-col gap-y-6">
      <h2 className="text-lg font-medium">Product Type</h2>
      <div className="grid w-2/3 grid-cols-3 gap-6">
        {productTypes.map((productType) => {
          const isActive = useMemo(
            () => selectedType === productType.name,
            [productType, selectedType],
          )

          const TypeIcon = productType.icon

          return (
            <div
              key={productType.name}
              className={twMerge(
                'dark:border-polar-700 dark:bg-polar-900 dark:hover:bg-polar-800 flex cursor-pointer flex-col gap-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-colors hover:bg-blue-50',
                isActive &&
                  'border-blue-100 bg-gradient-to-l from-blue-50 to-blue-100 dark:border-blue-400 dark:from-blue-950 dark:to-transparent dark:hover:border-blue-300',
              )}
              onClick={onSelectType.bind(null, productType.name)}
            >
              <span
                className={twMerge(
                  'text-blue-500 opacity-30 dark:text-blue-400',
                  isActive && 'opacity-100',
                )}
              >
                <TypeIcon fontSize="large" />
              </span>
              <div className="flex flex-col gap-y-2">
                <h3 className="dark:text-polar-50 font-medium text-gray-950">
                  {productType.name}
                </h3>
                <p
                  className={twMerge(
                    'dark:text-polar-500 text-sm text-gray-500',
                    isActive && 'dark:text-polar-300 text-sm text-gray-700',
                  )}
                >
                  {productType.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ProductUploadManager = () => {
  const [files, setFiles] = useState<File[]>([])
  const { handleDrag, handleDragOver, handleDrop } = useUploadManager(setFiles)

  const emptyState = useMemo(
    () => (
      <div className="dark:text-polar-500 flex w-full flex-col items-center gap-y-4 p-12 text-gray-500">
        <UploadFileOutlined fontSize="large" />
        <div className="flex flex-col items-center gap-y-2 text-center">
          <h3 className="dark:text-polar-300 font-medium text-gray-700">
            Drag & Drop
          </h3>
          <p className="text-sm">Upload your product</p>
        </div>
      </div>
    ),
    [],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <h2 className="text-lg font-medium">Files</h2>
      <ShadowBoxOnMd
        className="flex w-2/3 flex-col items-start gap-y-2"
        onDrop={handleDrop}
        onDrag={handleDrag}
        onDragOver={handleDragOver}
      >
        {files.length < 1
          ? emptyState
          : files.map((file) => (
              <div
                key={file.name}
                className="dark:bg-polar-800 flex w-full flex-row items-center justify-between rounded-2xl bg-gray-50 p-4 pr-8"
              >
                <div className="flex flex-row items-center gap-x-4 text-sm">
                  <div
                    className="dark:bg-polar-700 aspect-square w-16 rounded-xl bg-gray-100 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${URL.createObjectURL(file)})`,
                    }}
                  />
                  <div className="flex flex-col gap-y-2 text-sm">
                    <h3>{file.name}</h3>
                    <div className="dark:text-polar-500 flex flex-row gap-x-4 text-gray-500">
                      <span>
                        {Intl.NumberFormat('en-US', {
                          style: 'unit',
                          unit: 'byte',
                          unitDisplay: 'narrow',
                          notation: 'compact',
                        }).format(file.size)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-row gap-x-4">
                  <Button
                    className="h-8 w-8 rounded-full"
                    variant="secondary"
                    onClick={() =>
                      setFiles((files) => files.filter((f) => f !== file))
                    }
                  >
                    <CloseOutlined fontSize="inherit" />
                  </Button>
                </div>
              </div>
            ))}
      </ShadowBoxOnMd>
    </div>
  )
}

const useUploadManager = (setFiles: Dispatch<SetStateAction<File[]>>) => {
  const handleDrag: DragEventHandler<HTMLDivElement> = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop: DragEventHandler<HTMLDivElement> = useCallback(
    async (e) => {
      if (e.target instanceof HTMLDivElement) {
        e.preventDefault()
        e.stopPropagation()

        for (const file of e.dataTransfer.files) {
          setFiles((files) => [...files, file])
        }
      }
    },
    [setFiles],
  )

  const handleDragOver: DragEventHandler<HTMLDivElement> = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return {
    handleDrag,
    handleDrop,
    handleDragOver,
  }
}
