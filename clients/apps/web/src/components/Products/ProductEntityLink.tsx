'use client'

import { EntityLink } from '@/components/Shared/EntityLink'
import { type EntityMenuAction } from '@/components/Shared/EntityLinkMenu'
import { useFilterMenuItem } from '@/components/Shared/useFilterMenuItem'
import { schemas } from '@polar-sh/client'

interface LinkedProduct {
  id: string
  name: string
}

export const getProductHref = (
  organization: schemas['Organization'],
  product: LinkedProduct,
) => `/dashboard/${organization.slug}/products/${product.id}`

// What can be done with a product from its link, in a list that can be
// filtered by product: narrow the list down to it, or copy its ID.
export const useProductMenuItems = (
  product: LinkedProduct,
): EntityMenuAction[] => {
  const filter = useFilterMenuItem(
    'product_id',
    product.id,
    'Filter by this product',
  )
  return [...filter, { label: 'Copy product ID', copy: product.id }]
}

export const ProductEntityLink = ({
  organization,
  product,
  minimal,
  muted,
}: {
  organization: schemas['Organization']
  product: LinkedProduct
  minimal?: boolean
  muted?: boolean
}) => (
  <EntityLink
    kind="product"
    minimal={minimal}
    muted={muted}
    href={getProductHref(organization, product)}
    menuItems={useProductMenuItems(product)}
  >
    {product.name}
  </EntityLink>
)
