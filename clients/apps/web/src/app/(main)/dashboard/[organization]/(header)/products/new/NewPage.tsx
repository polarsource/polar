'use client'

import { CreateProductPageWrapper } from '@/components/Products/CreateProductPageWrapper'
import { schemas } from '@polar-sh/client'
import { useSearchParams } from 'next/navigation'

export default function Page({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const searchParams = useSearchParams()
  const fromProductId = searchParams.get('fromProductId')

  return (
    <CreateProductPageWrapper
      organization={organization}
      fromProductId={fromProductId ?? undefined}
    />
  )
}
