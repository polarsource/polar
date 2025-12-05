'use client'

import { ProductPage } from '@/components/Products/ProductPage/ProductPage'
import { schemas } from '@polar-sh/client'

export default function Page({
  organization,
  product,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
}) {
  return (
    <ProductPage
      product={product as schemas['Product']}
      organization={organization}
    />
  )
}
