'use client'

import { EditProductPage } from '@/components/Products/EditProductPage'
import { schemas } from '@polar-sh/client'
import { useSearchParams } from 'next/navigation'

export default function Page({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
}) {
  const searchParams = useSearchParams()
  const returnToRaw = searchParams.get('return_to')
  const returnTo =
    returnToRaw && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//')
      ? returnToRaw
      : undefined

  return (
    <EditProductPage
      product={product}
      organization={organization}
      returnTo={returnTo}
    />
  )
}
