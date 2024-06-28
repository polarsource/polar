'use client'

import { EditProductPage } from '@/components/Products/EditProductPage'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useProduct } from '@/hooks/queries'
import { useParams } from 'next/navigation'

export default function Page() {
  const { id } = useParams()
  const { org } = useCurrentOrgAndRepoFromURL()

  const { data: product } = useProduct(id as string)

  if (!org || !product) {
    return null
  }

  return <EditProductPage product={product} organization={org} />
}
