'use client'

import { CreateProductPage } from '@/components/Products/CreateProductPage'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'

export default function Page() {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  return <CreateProductPage organization={org} />
}
