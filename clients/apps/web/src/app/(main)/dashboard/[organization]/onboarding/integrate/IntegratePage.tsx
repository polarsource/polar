'use client'

import { IntegrateStep } from '@/components/Onboarding/IntegrateStep'
import { useSelectedProducts } from '@/hooks/queries/products'

import { useSearchParams } from 'next/navigation'

export default function ClientPage() {
  const searchParams = useSearchParams()

  const productIdsParam = searchParams.get('productId')
  const productIds = productIdsParam ? productIdsParam.split(',') : []

  const { data: products, isLoading } = useSelectedProducts(productIds)

  if (isLoading || !products || products.length === 0) {
    return null
  }

  return <IntegrateStep products={products} />
}
