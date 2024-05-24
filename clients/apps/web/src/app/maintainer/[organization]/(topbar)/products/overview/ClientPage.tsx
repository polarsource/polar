'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { CreateProductModal } from '@/components/Products/CreateProductModal'
import { EditProductModal } from '@/components/Products/EditProductModal'
import { ProductCard } from '@/components/Products/ProductCard'
import ProductPriceTypeSelect from '@/components/Products/ProductPriceTypeSelect'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useProduct, useProducts } from '@/hooks/queries/products'
import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  AddOutlined,
  CloseOutlined,
  DiamondOutlined,
} from '@mui/icons-material'
import { ProductPriceType } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useCallback, useEffect, useState } from 'react'

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
    if (searchParams?.has('product')) {
      showEditProductModal()
    } else {
      hideEditProductModal()
    }
  }, [searchParams, showEditProductModal, hideEditProductModal])

  const productPriceType: ProductPriceType | 'all' =
    (searchParams?.get('type') as ProductPriceType | 'all') || 'all'
  const onFilterChange = useCallback(
    (value: ProductPriceType | 'all') => {
      const params = new URLSearchParams({ type: value })
      router.push(
        `/maintainer/${org?.name}/products/overview?${params.toString()}`,
      )
    },
    [router, org],
  )

  const { data: product } = useProduct(
    searchParams?.get('product') ?? undefined,
  )
  const products = useProducts(org?.id, {
    isRecurring:
      productPriceType === 'all'
        ? undefined
        : productPriceType === ProductPriceType.RECURRING,
  })

  const announcementKey = 'subscriptionTiersManagementMoved'
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(
    localStorage.getItem(announcementKey) === 'true',
  )
  const dismissAnnouncement = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      localStorage.setItem(announcementKey, 'true')
      setDismissedAnnouncement(true)
    },
    [],
  )

  return (
    <DashboardBody className="flex flex-col gap-8">
      {!dismissedAnnouncement && (
        <div className="flex flex-row gap-y-8 rounded-3xl bg-gradient-to-r from-blue-200 to-blue-400 p-6 text-white">
          <div className="flex w-full flex-col gap-y-4">
            <DiamondOutlined fontSize="large" />
            <h3 className="text-xl leading-normal [text-wrap:balance]">
              Subscription Tiers management has been moved!
            </h3>
            <p className="">
              Your Subscription Tiers are now managed from the new Products
              section. Soon, we&apos;ll also add support to one-time purchase
              products and more!
            </p>
          </div>
          <div
            className="cursor-pointer hover:text-gray-300"
            onClick={dismissAnnouncement}
          >
            <CloseOutlined fontSize="inherit" />
          </div>
        </div>
      )}
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-lg">Overview</h1>
        <div className="flex w-1/3 flex-row items-center justify-end gap-2 md:w-1/5">
          {isFeatureEnabled('products') && (
            <ProductPriceTypeSelect
              value={productPriceType}
              onChange={onFilterChange}
            />
          )}
          <Button size="icon" onClick={showCreateProductModal}>
            <AddOutlined className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.data?.items?.map((product) => (
          <Link
            key={product.id}
            href={`/maintainer/${org?.name}/products/overview?product=${product.id}&type=${productPriceType}`}
          >
            <ProductCard product={product} />
          </Link>
        ))}
      </div>
      {org && (
        <>
          <InlineModal
            isShown={isCreateProductModalShown}
            hide={hideCreateProductModal}
            modalContent={
              <CreateProductModal
                organization={org}
                productPriceType={
                  productPriceType !== 'all' ? productPriceType : undefined
                }
                hide={hideCreateProductModal}
              />
            }
          />
          {product && (
            <InlineModal
              isShown={isEditProductModalShown}
              hide={() => {
                router.replace(
                  `/maintainer/${org?.name}/products/overview?type=${productPriceType}`,
                )
              }}
              modalContent={
                <EditProductModal
                  product={product}
                  organization={org}
                  hide={() => {
                    router.replace(
                      `/maintainer/${org?.name}/products/overview?type=${productPriceType}`,
                    )
                  }}
                />
              }
            />
          )}
        </>
      )}
    </DashboardBody>
  )
}
