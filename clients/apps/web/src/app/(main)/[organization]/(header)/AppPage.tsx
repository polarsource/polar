'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { schemas } from '@polar-sh/client'

const ClientPage = ({
  organization,
  products,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
}) => {
  return <Storefront organization={organization} products={products} />
}

export default ClientPage
