'use client'

import { EntityLink, type EntityIcon } from '@/components/Shared/EntityLink'
import { type EntityMenuAction } from '@/components/Shared/EntityLinkMenu'
import { useFilterMenuItem } from '@/components/Shared/useFilterMenuItem'
import { schemas } from '@polar-sh/client'
import { Layer, Layers2 } from '@polar-sh/orbit/icons'
import { ProductPreview } from './ProductPreview'

interface LinkedProduct {
  id: string
  name: string
  recurring_interval: string | null
}

export const getProductIcon = (product: LinkedProduct): EntityIcon =>
  product.recurring_interval ? Layers2 : Layer

export const getProductHref = (
  organization: schemas['Organization'],
  product: LinkedProduct,
) => `/dashboard/${organization.slug}/products/${product.id}`

// What can be done with a product from its link. In a list that filters by
// product the list is narrowed down to it; anywhere else the way leads to its
// subscriptions.
export const useProductMenuItems = (
  organization: schemas['Organization'],
  product: LinkedProduct,
  filterable: boolean,
): EntityMenuAction[] => {
  const filter = useFilterMenuItem(
    'product_id',
    product.id,
    'Filter by this product',
  )
  return [
    ...(filterable
      ? filter
      : [
          {
            label: 'View subscriptions',
            href: `/dashboard/${organization.slug}/sales/subscriptions?view=table&product_id=${product.id}`,
          },
        ]),
    { label: 'Copy product ID', copy: product.id },
  ]
}

// A product as a link to its page, with a card about it and a menu.
export const ProductEntityLink = ({
  organization,
  product,
  filterable = false,
  menuItems = [],
  minimal,
  muted,
}: {
  organization: schemas['Organization']
  product: LinkedProduct
  filterable?: boolean
  // Shown ahead of what every product link offers.
  menuItems?: EntityMenuAction[]
  minimal?: boolean
  muted?: boolean
}) => (
  <EntityLink
    kind="product"
    icon={getProductIcon(product)}
    minimal={minimal}
    muted={muted}
    href={getProductHref(organization, product)}
    menuItems={[
      ...menuItems,
      ...useProductMenuItems(organization, product, filterable),
    ]}
    preview={
      <ProductPreview organization={organization} productId={product.id} />
    }
  >
    {product.name}
  </EntityLink>
)
