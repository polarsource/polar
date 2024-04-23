'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { CreateProductModal } from '@/components/Products/CreateProductModal'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Product, useProducts } from '@/hooks/queries/products'
import { getCentsInDollarString } from '@/utils/money'
import { AddOutlined, PanoramaOutlined } from '@mui/icons-material'
import Image from 'next/image'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'

export default function ClientPage() {
  const { org } = useCurrentOrgAndRepoFromURL()

  const {
    isShown: isCreateProductModalShown,
    hide: hideCreateProductModal,
    show: showCreateProductModal,
  } = useModal()

  const products = useProducts(org?.name)

  return (
    <DashboardBody className="flex flex-col gap-8">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-lg">Overview</h1>
        <Button size="icon" onClick={showCreateProductModal}>
          <AddOutlined className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {products.data?.items.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
      <InlineModal
        isShown={isCreateProductModalShown}
        hide={hideCreateProductModal}
        modalContent={<CreateProductModal hide={hideCreateProductModal} />}
      />
    </DashboardBody>
  )
}

interface ProductTileProps {
  product: Product
}

const ProductTile = ({ product }: ProductTileProps) => {
  return (
    <div className="flex w-full flex-col gap-8 rounded-3xl bg-white p-6 shadow-sm">
      {product.media ? (
        <Image
          className="aspect-square w-full rounded-2xl bg-gray-100 object-cover"
          alt={`${product.name} product image`}
          width={400}
          height={400}
          src={product.media ?? ''}
        />
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-gray-100">
          <PanoramaOutlined className="text-gray-500" />
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
        <h3 className="font-medium leading-snug text-blue-500">
          ${getCentsInDollarString(product.price)}
        </h3>
        <Pill className="px-2.5 py-1" color="blue">
          {product.benefits.length === 1
            ? `${product.benefits.length} Benefit`
            : `${product.benefits.length} Benefits`}{' '}
        </Pill>
      </div>
    </div>
  )
}
