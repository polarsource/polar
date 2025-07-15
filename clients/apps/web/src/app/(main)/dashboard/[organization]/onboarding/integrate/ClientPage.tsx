'use client'

import { IntegrateStep } from '@/components/Onboarding/IntegrateStep'
import { useProduct } from '@/hooks/queries/products'

import { useSearchParams } from 'next/navigation'

export default function ClientPage() {
  const searchParams = useSearchParams()

  const productId = searchParams.get('productId')

  const { data: product } = useProduct(productId ?? undefined)

  if (!product) {
    return null
  }

  return <IntegrateStep product={product} />
}
