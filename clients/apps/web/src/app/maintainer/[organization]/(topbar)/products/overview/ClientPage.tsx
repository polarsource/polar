'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { CreateProductModal } from '@/components/Products/CreateProductModal'
import { EditProductModal } from '@/components/Products/EditProductModal'
import { ProductCard } from '@/components/Products/ProductCard'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useProduct, useProducts } from '@/hooks/queries/products'
import { AddOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
          <Link
            key={product.id}
            href={`/maintainer/${org?.name}/products/overview?product=${product.id}`}
          >
            <ProductCard product={product} />
          </Link>
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
