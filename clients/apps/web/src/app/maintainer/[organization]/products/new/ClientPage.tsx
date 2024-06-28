'use client'

import { CreateProductPage } from '@/components/Products/CreateProductPage'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'

export default function Page() {
  const { org } = useCurrentOrgAndRepoFromURL()

  if (!org) {
    return null
  }

  return <CreateProductPage organization={org} />
}
