'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EnableProductsView } from '@/components/Products/EnableProductsView'
import { ProductCard } from '@/components/Products/ProductCard'
import ProductPriceTypeSelect from '@/components/Products/ProductPriceTypeSelect'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useProducts } from '@/hooks/queries/products'
import { AddOutlined } from '@mui/icons-material'
import { Product, ProductPriceType } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useCallback } from 'react'

export default function ClientPage() {
  const { org } = useCurrentOrgAndRepoFromURL()
  const searchParams = useSearchParams()
  const router = useRouter()

  const productPriceType: ProductPriceType | 'all' =
    (searchParams?.get('type') as ProductPriceType | 'all') || 'all'

  const onFilterChange = useCallback(
    (value: ProductPriceType | 'all') => {
      const params = new URLSearchParams({ type: value })
      router.push(
        `/maintainer/${org?.slug}/products/overview?${params.toString()}`,
      )
    },
    [router, org],
  )

  const products = useProducts(org?.id, {
    isRecurring:
      productPriceType === 'all'
        ? undefined
        : productPriceType === ProductPriceType.RECURRING,
  })

  const sortProducts = useCallback((a: Product, b: Product) => {
    if (a.is_recurring && !b.is_recurring) {
      return -1
    }
    if (!a.is_recurring && b.is_recurring) {
      return 1
    }
    return 0
  }, [])

  if (org && !org.feature_settings?.subscriptions_enabled) {
    return <EnableProductsView organization={org} />
  }

  return (
    <DashboardBody className="flex flex-col gap-8">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-lg">Overview</h1>
        <div className="flex w-1/3 flex-row items-center justify-end gap-6 md:w-1/5">
          <ProductPriceTypeSelect
            value={productPriceType}
            onChange={onFilterChange}
          />
          <Link href={`/maintainer/${org?.slug}/products/new`}>
            <Button size="icon" role="link">
              <AddOutlined className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.data?.items?.sort(sortProducts).map((product) => (
          <Link
            key={product.id}
            href={`/maintainer/${org?.slug}/products/${product.id}`}
          >
            {product.is_recurring ? (
              <SubscriptionTierCard
                className="h-full"
                subscriptionTier={product}
              />
            ) : (
              <ProductCard product={product} />
            )}
          </Link>
        ))}
      </div>
    </DashboardBody>
  )
}
