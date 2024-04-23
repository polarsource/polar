'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { CreateProductModal } from '@/components/Products/CreateProductModal'
import { EditProductModal } from '@/components/Products/EditProductModal'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Product, useProduct, useProducts } from '@/hooks/queries/products'
import { getCentsInDollarString } from '@/utils/money'
import { AddOutlined, PanoramaOutlined } from '@mui/icons-material'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { useEffect } from 'react'

export default function ClientPage() {
  const { org } = useCurrentOrgAndRepoFromURL()
  const searchParams = useSearchParams()
  const router = useRouter()

  const {
    isShown: isCreateProductModalShown,
    hide: hideCreateProductModal,
    show: showCreateProductModal,
  } = useModal()

  const {
    isShown: isEditProductModalShown,
    hide: hideEditProductModal,
    show: showEditProductModal,
  } = useModal()

  useEffect(() => {
    if (searchParams.has('product')) {
      showEditProductModal()
    } else {
      hideEditProductModal()
    }
  }, [searchParams, showEditProductModal, hideEditProductModal])

  const { data: product } = useProduct(searchParams.get('product') ?? undefined)
  const products = useProducts(org?.name)

  return (
    <DashboardBody className="flex flex-col gap-8">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-lg">Overview</h1>
        <Button size="icon" onClick={showCreateProductModal}>
          <AddOutlined className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.data?.items.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
      <InlineModal
        isShown={isCreateProductModalShown}
        hide={hideCreateProductModal}
        modalContent={<CreateProductModal hide={hideCreateProductModal} />}
      />
      <InlineModal
        isShown={isEditProductModalShown}
        hide={() => {
          router.replace(`/maintainer/${org?.name}/products/overview`)
        }}
        modalContent={
          product ? (
            <EditProductModal
              product={product}
              hide={() => {
                router.replace(`/maintainer/${org?.name}/products/overview`)
              }}
            />
          ) : (
            <></>
          )
        }
      />
    </DashboardBody>
  )
}

interface ProductTileProps {
  product: Product
}

const ProductTile = ({ product }: ProductTileProps) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  return (
    <Link
      className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex w-full flex-col gap-8 rounded-3xl border border-transparent bg-white p-6 shadow-sm transition-colors hover:bg-gray-50"
      href={`/maintainer/${org?.name}/products/overview?product=${product.id}`}
    >
      {product.media ? (
        <Image
          className="aspect-square w-full rounded-2xl bg-gray-100 object-cover"
          alt={`${product.name} product image`}
          width={400}
          height={400}
          src={product.media ?? ''}
        />
      ) : (
        <div className="dark:bg-polar-900 flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-gray-100">
          <PanoramaOutlined className="dark:text-polar-500 text-gray-500" />
        </div>
      )}
      <div className="flex flex-grow flex-col gap-2">
        <h3 className="line-clamp-2 font-medium leading-snug">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-sm text-gray-500">
          {product.description}
        </p>
      </div>
      <div className="flex flex-row items-center justify-between">
        <h3 className="font-medium leading-snug text-blue-500 dark:text-blue-400">
          ${getCentsInDollarString(product.price)}
        </h3>
        <Pill className="px-2.5 py-1" color="blue">
          {product.benefits.length === 1
            ? `${product.benefits.length} Benefit`
            : `${product.benefits.length} Benefits`}{' '}
        </Pill>
      </div>
    </Link>
  )
}
