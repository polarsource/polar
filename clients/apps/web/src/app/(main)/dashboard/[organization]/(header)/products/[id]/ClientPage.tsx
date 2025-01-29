'use client'

import { ProductPage } from '@/components/Products/ProductPage/ProductPage'
import { useProduct } from '@/hooks/queries'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useParams } from 'next/navigation'
import { useContext } from 'react'

export default function Page() {
  const { id } = useParams()
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const { data: product } = useProduct(id as string)

  return product ? <ProductPage product={product} organization={org} /> : null
}
